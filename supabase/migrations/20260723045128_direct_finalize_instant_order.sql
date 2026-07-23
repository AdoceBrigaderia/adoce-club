create or replace function public.staff_finalize_instant_order_direct(
  target_order_id uuid,
  requested_payment_method text,
  next_internal_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.instant_orders%rowtype;
  original_status text;
  payment_result jsonb := '{}'::jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso nao autorizado';
  end if;

  select *
  into target
  from public.instant_orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Pedido nao encontrado';
  end if;

  if target.status in ('completed', 'cancelled', 'expired') then
    raise exception 'Este pedido nao pode ser finalizado por este fluxo';
  end if;

  original_status := target.status;

  if target.status = 'awaiting_confirmation' then
    perform public.staff_update_instant_order(
      target_order_id,
      'awaiting_payment',
      null,
      null,
      coalesce(next_internal_notes, target.internal_notes),
      null
    );
  elsif target.status = 'reserved' then
    perform public.staff_update_instant_order(
      target_order_id,
      'awaiting_payment',
      null,
      null,
      coalesce(next_internal_notes, target.internal_notes),
      null
    );
  end if;

  perform private.snapshot_instant_order_payment(
    target_order_id,
    requested_payment_method
  );

  select *
  into target
  from public.instant_orders
  where id = target_order_id
  for update;

  if target.status = 'awaiting_payment' then
    payment_result := public.staff_confirm_instant_order_payment(
      target_order_id,
      coalesce(next_internal_notes, target.internal_notes)
    );
  elsif target.status not in ('paid', 'preparing', 'ready') then
    raise exception 'O pedido nao esta em uma etapa que permita a finalizacao direta';
  end if;

  perform public.staff_update_instant_order(
    target_order_id,
    'completed',
    null,
    null,
    coalesce(next_internal_notes, target.internal_notes),
    null
  );

  update public.instant_orders
  set payment_recorded_at = coalesce(payment_recorded_at, now()),
      updated_at = now()
  where id = target_order_id;

  insert into public.audit_events(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  )
  values (
    (select auth.uid()),
    'instant_order.directly_completed',
    'instant_order',
    target_order_id::text,
    jsonb_build_object(
      'from_status', original_status,
      'payment_method', requested_payment_method,
      'skipped_payment_confirmation', target.status in ('paid', 'preparing', 'ready')
    )
  );

  return payment_result || jsonb_build_object(
    'order_id', target_order_id,
    'order_number', target.order_number,
    'completed', true,
    'payment_method', requested_payment_method
  );
end;
$$;

revoke all on function public.staff_finalize_instant_order_direct(uuid,text,text)
  from public, anon;
grant execute on function public.staff_finalize_instant_order_direct(uuid,text,text)
  to authenticated;
