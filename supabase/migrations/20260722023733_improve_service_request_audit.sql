-- Preserva um histórico mais útil das mudanças de pedidos sem expor dados ao público.
-- Mantém a assinatura da RPC para a homologação continuar compatível com a produção.

create or replace function public.manager_update_service_request(
  target_request_id uuid,
  next_status text,
  next_total numeric default null,
  next_deposit numeric default null,
  next_internal_notes text default null
)
returns public.service_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_request public.service_requests%rowtype;
  updated_request public.service_requests%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_manager()) then
    raise exception 'Acesso não autorizado';
  end if;
  if next_status not in ('prebooked','quoted','awaiting_deposit','confirmed','in_production','ready','completed','cancelled','expired') then
    raise exception 'Status inválido';
  end if;

  select * into current_request
  from public.service_requests
  where id = target_request_id
  for update;
  if not found then raise exception 'Solicitação não encontrada'; end if;

  update public.service_requests
  set status = next_status,
      quoted_total = coalesce(next_total, quoted_total),
      deposit_amount = coalesce(next_deposit, deposit_amount),
      deposit_paid_at = case when next_status = 'confirmed' then coalesce(deposit_paid_at, now()) else deposit_paid_at end,
      expires_at = case when next_status in ('confirmed','cancelled','completed','expired') then null else expires_at end,
      internal_notes = coalesce(next_internal_notes, internal_notes),
      updated_by = (select auth.uid())
  where id = target_request_id
  returning * into updated_request;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()),
    'service_request_status_changed',
    'service_request',
    updated_request.id,
    jsonb_build_object(
      'from_status', current_request.status,
      'status', next_status,
      'request_number', updated_request.request_number,
      'details_changed',
        current_request.quoted_total is distinct from updated_request.quoted_total
        or current_request.deposit_amount is distinct from updated_request.deposit_amount
        or current_request.internal_notes is distinct from updated_request.internal_notes
    )
  );
  return updated_request;
end;
$$;

revoke all on function public.manager_update_service_request(uuid,text,numeric,numeric,text) from public;
grant execute on function public.manager_update_service_request(uuid,text,numeric,numeric,text) to authenticated;
