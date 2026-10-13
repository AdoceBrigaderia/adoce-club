-- Pedidos de 24/09/2026
-- 1. Caixa diário: abertura com comprovante impresso e fechamento automático
--    (contado = esperado) com relatório marcado como automático.
-- 2. Atendimento do WhatsApp: telefone completo guardado de forma privada
--    (somente service_role) para mostrar número e nome na operação.

-- ---------------------------------------------------------------------------
-- 1. Comprovante de abertura de caixa
-- ---------------------------------------------------------------------------
create table if not exists public.cash_opening_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.cash_sessions(id),
  store_id uuid not null references public.stores(id),
  report jsonb not null,
  created_at timestamptz not null default now(),
  printed_at timestamptz
);
alter table public.cash_opening_reports enable row level security;
revoke all on public.cash_opening_reports from public, anon, authenticated;
grant select on public.cash_opening_reports to authenticated;
drop policy if exists cash_opening_reports_staff_read on public.cash_opening_reports;
create policy cash_opening_reports_staff_read on public.cash_opening_reports
  for select to authenticated
  using (private.is_staff() and private.can_access_store(store_id));

create or replace function public.staff_open_cash_with_report(target_register_id uuid, next_opening_float numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare opened jsonb; s public.cash_sessions%rowtype; r jsonb;
begin
  opened := public.staff_open_cash_session(target_register_id, next_opening_float, 'Abertura pela tela Caixa');
  select * into s from public.cash_sessions where id = (opened->>'id')::uuid;
  r := jsonb_build_object(
    'session', to_jsonb(s),
    'store_name', (select name from public.stores where id = s.store_id),
    'register_name', (select name from public.cash_registers where id = s.register_id),
    'opened_by_name', coalesce(
      (select coalesce(nullif(p.nickname, ''), p.full_name) from public.staff_private_profiles p where p.user_id = s.opened_by),
      'Equipe Adoce'
    )
  );
  insert into public.cash_opening_reports(session_id, store_id, report) values (s.id, s.store_id, r);
  return r;
end; $$;
revoke all on function public.staff_open_cash_with_report(uuid, numeric) from public, anon;
grant execute on function public.staff_open_cash_with_report(uuid, numeric) to authenticated;

create or replace function public.staff_ack_cash_opening_print(target_report_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
  update public.cash_opening_reports set printed_at = coalesce(printed_at, now())
  where id = target_report_id and private.can_access_store(store_id);
  if not found then raise exception 'Comprovante não encontrado'; end if;
end; $$;
revoke all on function public.staff_ack_cash_opening_print(uuid) from public, anon;
grant execute on function public.staff_ack_cash_opening_print(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Fechamento automático (meia-noite ou caixa esquecido de outro dia)
--    Contado = esperado. Libera pedidos iniciados antes de fechar.
-- ---------------------------------------------------------------------------
create or replace function public.staff_auto_close_cash_with_report(target_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.cash_sessions%rowtype; d record; expected numeric; r jsonb; existing jsonb;
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
  update public.cash_sessions
  set status = 'closed', closed_by = auth.uid(), closed_at = now(),
      expected_cash = expected, counted_cash = round(expected, 2), cash_difference = 0,
      closing_notes = 'Fechamento automático: dinheiro contado igual ao esperado.', updated_at = now()
  where id = s.id;

  r := public.staff_cash_closing_report(s.id) || jsonb_build_object('auto_closed', true);
  insert into public.cash_closing_reports(session_id, store_id, report) values (s.id, s.store_id, r);
  return r;
end; $$;
revoke all on function public.staff_auto_close_cash_with_report(uuid) from public, anon;
grant execute on function public.staff_auto_close_cash_with_report(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Telefone completo das conversas do WhatsApp (somente servidor)
-- ---------------------------------------------------------------------------
alter table private.whatsapp_support_threads
  add column if not exists phone_e164 text
  check (phone_e164 is null or phone_e164 ~ '^\+55[0-9]{10,11}$');

create or replace function public.server_whatsapp_thread_contacts(requested_ids uuid[])
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'phone_hmac', t.phone_hmac, 'phone_e164', t.phone_e164, 'source_message_sid', t.source_message_sid
  )), '[]')
  from private.whatsapp_support_threads t
  where t.id = any(requested_ids);
$$;
revoke all on function public.server_whatsapp_thread_contacts(uuid[]) from public, anon, authenticated;
grant execute on function public.server_whatsapp_thread_contacts(uuid[]) to service_role;

create or replace function public.server_set_whatsapp_thread_phone(requested_thread_id uuid, requested_phone text)
returns void language sql security definer set search_path = '' as $$
  update private.whatsapp_support_threads
  set phone_e164 = requested_phone
  where id = requested_thread_id and phone_e164 is null and requested_phone ~ '^\+55[0-9]{10,11}$';
$$;
revoke all on function public.server_set_whatsapp_thread_phone(uuid, text) from public, anon, authenticated;
grant execute on function public.server_set_whatsapp_thread_phone(uuid, text) to service_role;
