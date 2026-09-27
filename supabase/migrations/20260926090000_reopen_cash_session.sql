-- Reabrir um caixa já fechado para corrigir ou lançar vendas (pedido de 26/09/2026).
-- Regras:
--  * só proprietário ou gerente;
--  * só no mesmo dia (Fortaleza) em que o caixa foi fechado;
--  * não pode haver outro caixa aberto no mesmo registrador;
--  * o fechamento anterior (valores e relatório) fica guardado no histórico.
-- Se o caixa reaberto for fechado automaticamente, a diferença contada no
-- fechamento anterior é mantida (em vez de zerar a sobra/falta).

alter table public.cash_sessions
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references auth.users(id),
  add column if not exists reopen_count integer not null default 0,
  add column if not exists reopened_difference numeric(10,2);

create table if not exists private.cash_closing_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cash_sessions(id),
  closed_at timestamptz,
  closed_by uuid,
  expected_cash numeric(10,2),
  counted_cash numeric(10,2),
  cash_difference numeric(10,2),
  closing_notes text,
  report jsonb,
  reopened_by uuid not null,
  reopened_at timestamptz not null default now(),
  reason text not null
);

create or replace function public.manager_reopen_cash_session(target_session_id uuid, requested_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.cash_sessions%rowtype; other public.cash_sessions%rowtype; old_report jsonb;
  reason text := btrim(coalesce(requested_reason, ''));
begin
  if auth.uid() is null or not private.is_manager() then raise exception 'Somente proprietário ou gerente pode reabrir o caixa'; end if;
  select * into s from public.cash_sessions where id = target_session_id for update;
  if s.id is null or not private.can_access_store(s.store_id) then raise exception 'Caixa não encontrado'; end if;
  if s.status <> 'closed' then raise exception 'Este caixa não está fechado'; end if;
  if (s.closed_at at time zone 'America/Fortaleza')::date <> (now() at time zone 'America/Fortaleza')::date then
    raise exception 'Só é possível reabrir no mesmo dia do fechamento. Este caixa foi fechado em %.',
      to_char(s.closed_at at time zone 'America/Fortaleza', 'DD/MM/YYYY "às" HH24:MI');
  end if;
  if char_length(reason) < 3 then raise exception 'Informe o motivo da reabertura'; end if;
  select * into other from public.cash_sessions where register_id = s.register_id and status = 'open' and id <> s.id limit 1;
  if other.id is not null then
    raise exception 'Já existe um caixa aberto (nº %). Feche-o antes de reabrir este.', lpad(other.session_number::text, 4, '0');
  end if;

  select report into old_report from public.cash_closing_reports where session_id = s.id;
  insert into private.cash_closing_history(session_id, closed_at, closed_by, expected_cash, counted_cash, cash_difference, closing_notes, report, reopened_by, reason)
  values (s.id, s.closed_at, s.closed_by, s.expected_cash, s.counted_cash, s.cash_difference, s.closing_notes, old_report, auth.uid(), left(reason, 500));
  delete from public.cash_closing_reports where session_id = s.id;

  update public.cash_sessions
  set status = 'open', closed_at = null, closed_by = null, expected_cash = null, counted_cash = null,
      cash_difference = null, closing_notes = '', reopened_at = now(), reopened_by = auth.uid(),
      reopen_count = reopen_count + 1, reopened_difference = s.cash_difference, updated_at = now()
  where id = s.id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (auth.uid(), 'cash.session_reopened', 'cash_session', s.id::text,
    jsonb_build_object('session_number', s.session_number, 'reason', left(reason, 500),
      'previous_counted', s.counted_cash, 'previous_expected', s.expected_cash, 'previous_difference', s.cash_difference));
  return jsonb_build_object('reopened', true, 'session_number', s.session_number, 'previous_counted', s.counted_cash);
end; $$;
revoke all on function public.manager_reopen_cash_session(uuid, text) from public, anon;
grant execute on function public.manager_reopen_cash_session(uuid, text) to authenticated;

-- Fechamento automático de caixa reaberto: mantém a diferença do fechamento anterior.
create or replace function public.staff_auto_close_cash_with_report(target_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.cash_sessions%rowtype; d record; expected numeric; r jsonb; existing jsonb; diff numeric;
begin
  select * into s from public.cash_sessions where id = target_session_id for update;
  if auth.uid() is null or not private.is_staff() or s.id is null or not private.can_access_store(s.store_id) then
    raise exception 'Acesso não autorizado';
  end if;
  select report into existing from public.cash_closing_reports where session_id = target_session_id;
  if existing is not null then return existing; end if;
  if s.status <> 'open' then raise exception 'O caixa não está aberto'; end if;

  for d in select * from public.cash_draft_reservations where session_id = s.id order by flavor_id for update loop
    perform 1 from public.flavor_availability where flavor_id = d.flavor_id and service_date = d.service_date for update;
    delete from public.cash_draft_reservations where id = d.id;
    perform private.recalcular_reserva_de_fatias(d.flavor_id, d.service_date);
  end loop;

  expected := private.cash_expected_amount(s.id);
  diff := coalesce(s.reopened_difference, 0);
  update public.cash_sessions
  set status = 'closed', closed_by = auth.uid(), closed_at = now(),
      expected_cash = expected, counted_cash = round(expected + diff, 2), cash_difference = diff,
      closing_notes = case when s.reopened_at is null then 'Fechamento automático: dinheiro contado igual ao esperado.'
        else 'Fechamento automático de caixa reaberto: mantida a diferença do fechamento anterior.' end,
      updated_at = now()
  where id = s.id;

  r := public.staff_cash_closing_report(s.id) || jsonb_build_object('auto_closed', true);
  insert into public.cash_closing_reports(session_id, store_id, report) values (s.id, s.store_id, r);
  return r;
end; $$;
revoke all on function public.staff_auto_close_cash_with_report(uuid) from public, anon;
grant execute on function public.staff_auto_close_cash_with_report(uuid) to authenticated;
