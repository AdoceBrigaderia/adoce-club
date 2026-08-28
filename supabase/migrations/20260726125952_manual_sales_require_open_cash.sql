begin;

create or replace function public.staff_create_manual_sale_in_cash(
  target_session_id uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_payment_method text,
  requested_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_record public.cash_sessions%rowtype;
  sale_result jsonb;
  target_order public.instant_orders%rowtype;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso nao autorizado';
  end if;

  select * into session_record
  from public.cash_sessions
  where id = target_session_id and status = 'open'
  for update;

  if session_record.id is null then
    raise exception 'Abra o caixa antes de registrar uma venda presencial';
  end if;
  if not private.can_sell_at_store(session_record.store_id) then
    raise exception 'Voce nao possui permissao para vender nesta loja';
  end if;

  sale_result := public.staff_create_manual_sale(
    requested_customer_name,
    requested_customer_phone,
    requested_items,
    requested_payment_method,
    requested_notes
  );

  select * into target_order
  from public.instant_orders
  where id = (sale_result ->> 'order_id')::uuid;

  if target_order.id is null then
    raise exception 'A venda foi criada sem identificacao do pedido';
  end if;

  perform public.staff_record_cash_movement(
    session_record.id,
    'sale',
    coalesce(target_order.payment_method_code, requested_payment_method),
    target_order.total,
    concat('Venda ', target_order.order_number, case when btrim(coalesce(requested_notes, '')) <> '' then ' · ' || left(btrim(requested_notes), 700) else '' end),
    target_order.id
  );

  return sale_result || jsonb_build_object(
    'cash_session_id', session_record.id,
    'store_id', session_record.store_id,
    'cash_register_id', session_record.register_id,
    'cash_movement_recorded', true
  );
end;
$$;

revoke all on function public.staff_create_manual_sale(text,text,jsonb,text,text) from public;
revoke execute on function public.staff_create_manual_sale(text,text,jsonb,text,text) from authenticated;
revoke all on function public.staff_create_manual_sale_in_cash(uuid,text,text,jsonb,text,text) from public;
grant execute on function public.staff_create_manual_sale_in_cash(uuid,text,text,jsonb,text,text) to authenticated;

commit;
