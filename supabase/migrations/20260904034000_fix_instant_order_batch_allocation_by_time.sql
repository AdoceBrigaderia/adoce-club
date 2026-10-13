-- "Dar baixa" acusa falta de estoque com estoque no agregado.
--
-- Sintoma: pedido com horario de retirada X; estoque reposto/capturado depois de X
-- vira lote com available_from > X; private.allocate_instant_order_item_batches so
-- considera lotes com available_from <= pickup_requested_time e estoura
-- "Nao ha fatias suficientes deste sabor para o horario escolhido" mesmo com o
-- estoque agregado cheio (trava o "dar baixa" de pedidos ja vendidos).
--
-- (1) Higiene do gatilho de captura: aumento de estoque no mesmo dia nasce
--     disponivel para qualquer horario (available_from 00:00); so o sabor marcado
--     como retirada a noite (pickup_release='evening') nasce as 20:00. Alinha o
--     gatilho com o seed original da migracao de lotes (20260815110239).
-- (2) Passe de seguranca na alocacao: se depois do filtro por horario ainda falta
--     quantidade porem o estoque agregado do sabor cobre, aloca dos demais lotes
--     ativos (do mais cedo para o mais tarde). O caminho feliz (cliente novo) nao
--     muda: o primeiro laco ja resolve e o passe nao e acionado.
-- (3) Correcao pontual: lotes de hoje/futuros, sem reserva, que nasceram com hora
--     de relogio (nao-evening) passam a valer o dia todo (00:00).

begin;

create or replace function private.capture_unbatched_inventory_increase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  batches_total integer;
  missing_quantity integer;
  release_time time;
begin
  if new.quantity_available is null or new.quantity_available <= 0 then return new; end if;
  select coalesce(sum(batch.quantity_available), 0)::integer
  into batches_total
  from public.flavor_availability_batches batch
  where batch.flavor_id = new.flavor_id
    and batch.service_date = new.service_date
    and batch.active;
  missing_quantity := new.quantity_available - batches_total;
  if missing_quantity <= 0 then return new; end if;
  release_time := case
    when new.pickup_release = 'evening' then time '20:00'
    else time '00:00'
  end;
  insert into public.flavor_availability_batches(
    flavor_id, service_date, available_from, quantity_available,
    quantity_reserved, active, updated_by
  ) values (
    new.flavor_id, new.service_date, release_time, missing_quantity,
    0, true, new.updated_by
  )
  on conflict (flavor_id, service_date, available_from) do update
    set quantity_available = public.flavor_availability_batches.quantity_available
          + excluded.quantity_available,
        active = true,
        updated_by = excluded.updated_by,
        updated_at = now();
  return new;
end;
$$;

create or replace function private.allocate_instant_order_item_batches(
  target_order_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_item public.instant_order_items%rowtype;
  target_order public.instant_orders%rowtype;
  availability public.flavor_availability%rowtype;
  candidate record;
  remaining integer;
  take_quantity integer;
  batch_free integer;
  aggregate_free integer;
  pending_structured integer;
  adjustment integer;
  batch_count integer;
begin
  select * into target_item from public.instant_order_items
  where id = target_order_item_id for update;
  if not found or target_item.status <> 'reserved' then return; end if;
  if exists (
    select 1 from private.instant_order_batch_allocations allocation
    where allocation.order_item_id = target_item.id and allocation.status = 'reserved'
  ) then return; end if;

  select * into target_order from public.instant_orders
  where id = target_item.order_id for update;
  if target_order.pickup_requested_time is null then return; end if;

  select * into availability from public.flavor_availability
  where flavor_id = target_item.flavor_id
    and service_date = (now() at time zone 'America/Fortaleza')::date
  for update;
  if not found then raise exception 'O estoque deste sabor não está disponível hoje'; end if;

  perform 1 from public.flavor_availability_batches batch
  where batch.flavor_id = target_item.flavor_id
    and batch.service_date = availability.service_date
    and batch.active
  for update;

  select
    count(*)::integer,
    coalesce(sum(greatest(batch.quantity_available - batch.quantity_reserved, 0)), 0)::integer
  into batch_count, batch_free
  from public.flavor_availability_batches batch
  where batch.flavor_id = target_item.flavor_id
    and batch.service_date = availability.service_date
    and batch.active;
  if batch_count = 0 then return; end if;

  aggregate_free := greatest(
    coalesce(availability.quantity_available, 30) - availability.quantity_reserved,
    0
  );
  select coalesce(sum(item.quantity), 0)::integer
  into pending_structured
  from public.instant_order_items item
  join public.instant_orders order_row on order_row.id = item.order_id
  where item.flavor_id = target_item.flavor_id
    and item.status = 'reserved'
    and order_row.pickup_requested_time is not null
    and not exists (
      select 1 from private.instant_order_batch_allocations allocation
      where allocation.order_item_id = item.id and allocation.status = 'reserved'
    );
  adjustment := greatest(batch_free - aggregate_free - pending_structured, 0);
  remaining := target_item.quantity;

  for candidate in
    with base as (
      select
        batch.*,
        greatest(batch.quantity_available - batch.quantity_reserved, 0)::integer as free,
        coalesce(sum(greatest(batch.quantity_available - batch.quantity_reserved, 0)) over (
          order by batch.available_from
          rows between unbounded preceding and 1 preceding
        ), 0)::integer as free_before
      from public.flavor_availability_batches batch
      where batch.flavor_id = target_item.flavor_id
        and batch.service_date = availability.service_date
        and batch.active
    )
    select base.*,
      greatest(base.free - least(base.free, greatest(adjustment - base.free_before, 0)), 0)::integer
        as effective_free
    from base
    where base.available_from <= target_order.pickup_requested_time
    order by base.available_from desc
  loop
    exit when remaining <= 0;
    take_quantity := least(candidate.effective_free, remaining);
    if take_quantity <= 0 then continue; end if;
    update public.flavor_availability_batches
    set quantity_reserved = quantity_reserved + take_quantity,
        updated_at = now()
    where id = candidate.id;
    insert into private.instant_order_batch_allocations(
      order_item_id, batch_id, quantity, status
    ) values (target_item.id, candidate.id, take_quantity, 'reserved');
    remaining := remaining - take_quantity;
  end loop;

  -- Passe de seguranca: estoque reposto mais tarde (ou capturado com a hora do
  -- relogio) fica em lote com available_from posterior ao horario de retirada e
  -- e ignorado acima. Se ainda falta quantidade mas o estoque fisico do sabor
  -- cobre, aloca dos lotes restantes (do mais cedo para o mais tarde).
  if remaining > 0 and aggregate_free >= remaining then
    for candidate in
      select batch.id as id,
        greatest(batch.quantity_available - batch.quantity_reserved, 0)::integer as free
      from public.flavor_availability_batches batch
      where batch.flavor_id = target_item.flavor_id
        and batch.service_date = availability.service_date
        and batch.active
        and batch.available_from > target_order.pickup_requested_time
      order by batch.available_from asc
    loop
      exit when remaining <= 0;
      take_quantity := least(candidate.free, remaining);
      if take_quantity <= 0 then continue; end if;
      update public.flavor_availability_batches
      set quantity_reserved = quantity_reserved + take_quantity,
          updated_at = now()
      where id = candidate.id;
      insert into private.instant_order_batch_allocations(
        order_item_id, batch_id, quantity, status
      ) values (target_item.id, candidate.id, take_quantity, 'reserved');
      remaining := remaining - take_quantity;
    end loop;
  end if;

  if remaining > 0 then
    raise exception 'Não há fatias suficientes deste sabor para o horário escolhido';
  end if;
end;
$$;

update public.flavor_availability_batches b
set available_from = time '00:00', updated_at = now()
from public.flavor_availability fa
where fa.flavor_id = b.flavor_id
  and fa.service_date = b.service_date
  and b.service_date >= (now() at time zone 'America/Fortaleza')::date
  and b.active
  and b.quantity_reserved = 0
  and b.available_from > time '00:00'
  and b.available_from < time '20:00'
  and coalesce(fa.pickup_release, 'now') <> 'evening'
  and not exists (
    select 1 from public.flavor_availability_batches other
    where other.flavor_id = b.flavor_id
      and other.service_date = b.service_date
      and other.available_from = time '00:00'
      and other.id <> b.id
  );

commit;
