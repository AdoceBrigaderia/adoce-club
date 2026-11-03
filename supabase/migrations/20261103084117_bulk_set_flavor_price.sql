begin;

-- Pedido do proprietário em 03/11/2026: uma tela só para definir o preço da
-- fatia e aplicar a todos os sabores ativos de uma vez, em vez de editar
-- sabor por sabor. flavors.base_price continua sendo a fonte única lida por
-- cardápio, carrinho e pedidos online (fonte única de dados por produto) --
-- esta função só escreve nela em massa, não cria coluna nova nem duplica
-- o valor em outro lugar.
create or replace function public.manager_bulk_set_flavor_price(
  requested_price numeric
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  if not (select private.is_manager()) then
    raise exception 'Acesso restrito a proprietário e gerente.' using errcode = '42501';
  end if;

  if requested_price is null or requested_price <= 0 or requested_price > 1000 then
    raise exception 'Informe um preço válido para a fatia.' using errcode = '22023';
  end if;

  update public.flavors
     set base_price = requested_price
   where active = true;
  get diagnostics affected = row_count;

  return affected;
end;
$$;

revoke all on function public.manager_bulk_set_flavor_price(numeric)
  from public, anon;
grant execute on function public.manager_bulk_set_flavor_price(numeric)
  to authenticated;

commit;
