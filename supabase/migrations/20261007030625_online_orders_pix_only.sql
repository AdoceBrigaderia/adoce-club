-- Pedidos online aceitam apenas Pix; os demais meios continuam disponíveis
-- para lançamentos internos da operação.
-- Na base atual, a Torta de Pudim foi ajustada para 32,00 e ocultada com
-- autorização em 07/10/2026. A condição evita ocultá-la novamente quando
-- a operação decidir reativar o cadastro antes da instalação desta migração.
update public.flavors
set base_price = 32.00, active = false
where name = 'Torta de Pudim' and category = 'premium'
  and base_price = 25.00 and active = true;

update public.payment_methods
set customer_selectable = (code = 'pix'), updated_at = now()
where customer_selectable is distinct from (code = 'pix');

create or replace function public.get_checkout_payment_methods()
returns table(code text, label text)
language sql stable security definer set search_path = ''
as $$
  select method.code, method.label
  from public.payment_methods method
  where method.code = 'pix' and method.active and method.customer_selectable;
$$;
revoke all on function public.get_checkout_payment_methods() from public;
grant execute on function public.get_checkout_payment_methods() to anon, authenticated;

create or replace function private.snapshot_instant_order_payment(
  target_order_id uuid,
  requested_method_code text
)
returns public.instant_orders
language plpgsql security definer set search_path = ''
as $$
declare
  method_row public.payment_methods%rowtype;
  result public.instant_orders%rowtype;
  calculated_fee numeric(10,2);
begin
  if exists (
    select 1 from public.instant_orders target
    where target.id = target_order_id
      and target.sales_channel in ('site', 'pede_junto')
      and requested_method_code is distinct from 'pix'
  ) then
    raise exception 'Pedidos online aceitam apenas Pix';
  end if;

  select * into method_row from public.payment_methods
  where code = requested_method_code and active;
  if not found then raise exception 'Escolha uma forma de pagamento disponivel'; end if;

  select round((target.total * method_row.fee_percent / 100) + method_row.fee_fixed, 2)
  into calculated_fee
  from public.instant_orders target where target.id = target_order_id;

  update public.instant_orders target
  set payment_method_code = method_row.code,
      payment_method_label = method_row.label,
      payment_fee_percent = method_row.fee_percent,
      payment_fee_fixed = method_row.fee_fixed,
      gross_amount = target.total,
      payment_fee_amount = least(target.total, coalesce(calculated_fee, 0)),
      net_amount = greatest(0, target.total - coalesce(calculated_fee, 0)),
      updated_at = now()
  where target.id = target_order_id
  returning * into result;
  if not found then raise exception 'Pedido nao encontrado'; end if;
  return result;
end;
$$;
revoke all on function private.snapshot_instant_order_payment(uuid,text) from public, anon, authenticated;
