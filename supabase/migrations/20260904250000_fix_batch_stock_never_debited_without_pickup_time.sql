-- Tela "Disponibilidade de hoje" > Lotes por horario mostrava a quantidade
-- CHEIA de cada lote mesmo depois de vendas ja pagas (o "Total" embaixo,
-- esse sim, sempre esteve certo).
--
-- Causa: private.allocate_instant_order_item_batches so roda quando o
-- pedido tem pickup_requested_time definido -- sem isso ela retorna sem
-- criar nenhuma linha em private.instant_order_batch_allocations. Quando o
-- item e pago, private.finish_instant_order_item_batches so sabe descontar
-- o lote a partir dessas linhas de alocacao; sem nenhuma, ela nao tem o que
-- fazer e os lotes ficam intocados para sempre, ainda que o agregado
-- (public.flavor_availability, usado no calculo real de "quanto sobra")
-- ja tenha descontado certinho. A maioria dos pedidos de hoje nao tem
-- horario de retirada -- por isso o sintoma apareceu em quase todo sabor.

begin;

create or replace function private.finish_instant_order_item_batches(
  target_order_item_id uuid, next_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  allocation record;
  handled boolean := false;
  item_row public.instant_order_items%rowtype;
  order_row public.instant_orders%rowtype;
  remaining integer;
  candidate record;
  take_quantity integer;
begin
  if next_status not in ('paid', 'cancelled') then return; end if;
  for allocation in
    select stored.* from private.instant_order_batch_allocations stored
    where stored.order_item_id = target_order_item_id
      and stored.status = 'reserved'
    for update
  loop
    handled := true;
    if next_status = 'paid' then
      update public.flavor_availability_batches
      set quantity_available = greatest(0, quantity_available - allocation.quantity),
          quantity_reserved = greatest(0, quantity_reserved - allocation.quantity),
          updated_at = now()
      where id = allocation.batch_id;
    else
      update public.flavor_availability_batches
      set quantity_reserved = greatest(0, quantity_reserved - allocation.quantity),
          updated_at = now()
      where id = allocation.batch_id;
    end if;
    update private.instant_order_batch_allocations
    set status = next_status, updated_at = now()
    where id = allocation.id;
  end loop;

  -- Sem alocacao estruturada (pedido sem horario de retirada): desconta do
  -- lote mais cedo primeiro, mesmo criterio do "passe de seguranca" ja
  -- usado em allocate_instant_order_item_batches. So se aplica a "paid" --
  -- cancelamento de item sem alocacao nunca reservou lote nenhum, nao ha
  -- nada a devolver.
  if not handled and next_status = 'paid' then
    select * into item_row from public.instant_order_items where id = target_order_item_id;
    if found then
      select * into order_row from public.instant_orders where id = item_row.order_id;
      if found then
        remaining := item_row.quantity;
        for candidate in
          select batch.id as id,
            greatest(batch.quantity_available - batch.quantity_reserved, 0)::integer as free
          from public.flavor_availability_batches batch
          where batch.flavor_id = item_row.flavor_id
            and batch.service_date = (order_row.created_at at time zone 'America/Fortaleza')::date
            and batch.active
          order by batch.available_from asc
        loop
          exit when remaining <= 0;
          take_quantity := least(candidate.free, remaining);
          if take_quantity <= 0 then continue; end if;
          update public.flavor_availability_batches
          set quantity_available = greatest(0, quantity_available - take_quantity), updated_at = now()
          where id = candidate.id;
          remaining := remaining - take_quantity;
        end loop;
        -- Se nao houver lote ativo suficiente (ex.: lote excluido depois),
        -- nao ha erro nenhum -- o agregado ja e a fonte de verdade real, o
        -- lote e so uma quebra informativa por horario.
      end if;
    end if;
  end if;
end;
$function$;

-- Reconciliacao unica: aplica a mesma logica retroativamente aos itens ja
-- pagos hoje que nunca tiveram alocacao (os 5 pedidos finalizados antes
-- desta correcao), pra a tela "Disponibilidade de hoje" mostrar o lote
-- certo agora, sem esperar a proxima venda.
do $$
declare
  target record;
  item_row public.instant_order_items%rowtype;
  order_row public.instant_orders%rowtype;
  remaining integer;
  candidate record;
  take_quantity integer;
begin
  for target in
    select i.id
    from public.instant_order_items i
    join public.instant_orders o on o.id = i.order_id
    where i.status = 'paid'
      and (o.created_at at time zone 'America/Fortaleza')::date = (now() at time zone 'America/Fortaleza')::date
      and not exists (
        select 1 from private.instant_order_batch_allocations a where a.order_item_id = i.id
      )
  loop
    select * into item_row from public.instant_order_items where id = target.id;
    select * into order_row from public.instant_orders where id = item_row.order_id;
    remaining := item_row.quantity;
    for candidate in
      select batch.id as id,
        greatest(batch.quantity_available - batch.quantity_reserved, 0)::integer as free
      from public.flavor_availability_batches batch
      where batch.flavor_id = item_row.flavor_id
        and batch.service_date = (order_row.created_at at time zone 'America/Fortaleza')::date
        and batch.active
      order by batch.available_from asc
    loop
      exit when remaining <= 0;
      take_quantity := least(candidate.free, remaining);
      if take_quantity <= 0 then continue; end if;
      update public.flavor_availability_batches
      set quantity_available = greatest(0, quantity_available - take_quantity), updated_at = now()
      where id = candidate.id;
      remaining := remaining - take_quantity;
    end loop;
  end loop;
end;
$$;

commit;
