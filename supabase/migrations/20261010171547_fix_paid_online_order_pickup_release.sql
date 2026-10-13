-- Pagamento informado pela equipe confirma estoque e Clube uma única vez.
-- Pedidos online ficam prontos para retirada; balcão mantém conclusão direta.
create or replace function public.staff_finalize_instant_order_direct(
  target_order_id uuid,
  requested_payment_method text,
  next_internal_notes text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target public.instant_orders%rowtype;
  original_status text;
  final_status text;
  payment_result jsonb := '{}'::jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso nao autorizado';
  end if;
  select * into target from public.instant_orders where id = target_order_id for update;
  if not found then raise exception 'Pedido nao encontrado'; end if;
  if target.store_id is not null and not private.can_manage_orders_at_store(target.store_id) then
    raise exception 'Sem permissao para editar pedidos desta loja';
  end if;
  if target.status in ('completed', 'cancelled', 'expired') then
    raise exception 'Este pedido nao pode ser finalizado por este fluxo';
  end if;
  final_status := case when target.sales_channel = 'operation' then 'completed' else 'ready' end;
  if target.status = final_status and target.payment_status = 'approved' then
    return jsonb_build_object('order_id',target.id,'order_number',target.order_number,
      'already_confirmed',true,'status',final_status,'ready_for_pickup',final_status='ready');
  end if;
  original_status := target.status;
  if target.status = 'awaiting_confirmation' then
    perform public.staff_update_instant_order(target_order_id,'reserved',null,null,next_internal_notes,null);
  end if;
  if target.payment_status is distinct from 'approved' then
    perform private.snapshot_instant_order_payment(target_order_id,requested_payment_method);
    payment_result := public.staff_confirm_instant_order_payment(target_order_id,
      coalesce(next_internal_notes,target.internal_notes));
  end if;
  update public.instant_orders set separation_confirmed_at=coalesce(separation_confirmed_at,now())
  where id=target_order_id;
  perform public.staff_update_instant_order(target_order_id,final_status,null,null,
    coalesce(next_internal_notes,target.internal_notes),null);
  update public.instant_orders set payment_recorded_at=coalesce(payment_recorded_at,now()),updated_at=now()
  where id=target_order_id;
  -- A transação produz somente o aviso final; não manda cobrança após confirmar o recebimento.
  update private.order_customer_notifications set status='superseded',last_error='superseded_by_payment_and_pickup_release'
  where order_id=target_order_id and status='pending' and stage in ('reserved','awaiting_payment','paid','preparing');
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
  values((select auth.uid()),'instant_order.payment_and_pickup_confirmed','instant_order',target_order_id::text,
    jsonb_build_object('from_status',original_status,'status',final_status,'payment_method',requested_payment_method));
  return payment_result || jsonb_build_object('order_id',target_order_id,'order_number',target.order_number,
    'status',final_status,'completed',final_status='completed','ready_for_pickup',final_status='ready',
    'payment_method',requested_payment_method);
end;
$$;
revoke all on function public.staff_finalize_instant_order_direct(uuid,text,text) from public,anon;
grant execute on function public.staff_finalize_instant_order_direct(uuid,text,text) to authenticated;
