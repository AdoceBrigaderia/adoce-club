-- Fechamento de caixa bloqueado por "pedido iniciado" que já tinha expirado (25/09/2026).
-- Um carrinho do Caixa abandonado (tela recarregada, outro aparelho) deixava a reserva
-- em cash_draft_reservations; nada limpava as expiradas e o fechamento era recusado.
-- Agora o fechamento libera as reservas expiradas e, se ainda houver pedido ativo,
-- informa de quem é e até quando vale.

create or replace function private.release_expired_cash_drafts(target_session_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare d record; released integer := 0;
begin
  for d in select * from public.cash_draft_reservations
           where session_id = target_session_id and expires_at < now()
           order by flavor_id for update loop
    perform 1 from public.flavor_availability where flavor_id = d.flavor_id and service_date = d.service_date for update;
    delete from public.cash_draft_reservations where id = d.id;
    perform private.recalcular_reserva_de_fatias(d.flavor_id, d.service_date);
    released := released + d.quantity;
  end loop;
  return released;
end; $$;

create or replace function public.staff_close_cash_with_report(target_session_id uuid, next_counted_cash numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb; store uuid; active record;
begin
  select store_id into store from public.cash_sessions where id = target_session_id for update;
  if auth.uid() is null or not private.is_staff() or store is null or not private.can_access_store(store) then raise exception 'Acesso não autorizado'; end if;
  select report into r from public.cash_closing_reports where session_id = target_session_id;
  if r is not null then return r; end if;
  perform private.release_expired_cash_drafts(target_session_id);
  select private.staff_display_name(d.created_by) as who, sum(d.quantity) as slices, max(d.expires_at) as until
  into active
  from public.cash_draft_reservations d where d.session_id = target_session_id
  group by d.created_by order by max(d.expires_at) desc limit 1;
  if active.who is not null then
    raise exception 'Existe um pedido em andamento no Caixa de % (% fatia(s)). Conclua ou cancele esse pedido, ou aguarde até % para ele expirar.',
      active.who, active.slices, to_char(active.until at time zone 'America/Fortaleza', 'HH24:MI');
  end if;
  perform public.staff_close_cash_session(target_session_id, next_counted_cash, 'Fechamento pela tela Caixa');
  r := public.staff_cash_closing_report(target_session_id);
  insert into public.cash_closing_reports(session_id, store_id, report) values (target_session_id, store, r);
  return r;
end; $$;
revoke all on function public.staff_close_cash_with_report(uuid, numeric) from public, anon;
grant execute on function public.staff_close_cash_with_report(uuid, numeric) to authenticated;
