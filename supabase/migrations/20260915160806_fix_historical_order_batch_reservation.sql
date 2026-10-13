-- A reserva pertence ao dia do estoque utilizado, nao ao dia de criacao da venda.
alter table public.instant_order_items add column if not exists stock_service_date date;
create or replace function private.stamp_instant_order_stock_date() returns trigger
language plpgsql security definer set search_path='' as $function$
begin
  if new.status = 'reserved' and (tg_op = 'INSERT' or old.status <> 'reserved') then
    new.stock_service_date := (now() at time zone 'America/Fortaleza')::date;
  end if;
  return new;
end;
$function$;
revoke all on function private.stamp_instant_order_stock_date() from public,anon,authenticated;
create trigger stamp_instant_order_stock_date before insert or update of status on public.instant_order_items
for each row execute function private.stamp_instant_order_stock_date();
-- Reconhece a data comprovada por alocacoes existentes; nao inventa reservas.
update public.instant_order_items i set stock_service_date = dates.service_date
from (select a.order_item_id, min(b.service_date) service_date
      from private.instant_order_batch_allocations a join public.flavor_availability_batches b on b.id=a.batch_id
      group by a.order_item_id having count(distinct b.service_date)=1) dates
where i.id=dates.order_item_id and i.stock_service_date is null;
CREATE OR REPLACE FUNCTION private.allocate_instant_order_item_batches(target_order_item_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- Pedidos sem horario tambem reservam os lotes do dia.
  target_order.pickup_requested_time := case when (target_order.created_at at time zone 'America/Fortaleza')::date < (now() at time zone 'America/Fortaleza')::date
    then '23:59:59'::time else coalesce(target_order.pickup_requested_time, '23:59:59'::time) end;

  select * into availability from public.flavor_availability
  where flavor_id = target_item.flavor_id
    and service_date = coalesce(target_item.stock_service_date, (now() at time zone 'America/Fortaleza')::date)
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
    and coalesce(item.stock_service_date, (order_row.created_at at time zone 'America/Fortaleza')::date) = availability.service_date
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
$function$;
CREATE OR REPLACE FUNCTION private.recalcular_reserva_de_fatias(alvo_flavor uuid, alvo_data date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.flavor_availability a
  set quantity_reserved = coalesce((
        select sum(i.quantity)::int
        from public.instant_order_items i
        join public.instant_orders o on o.id = i.order_id
        where i.flavor_id = alvo_flavor
          and coalesce(i.stock_service_date, (o.created_at at time zone 'America/Fortaleza')::date) = alvo_data
          and o.status not in ('cancelled','expired')
          and i.status = 'reserved'
      ), 0),
      updated_at = now()
  where a.flavor_id = alvo_flavor and a.service_date = alvo_data;
end;
$function$;
CREATE OR REPLACE FUNCTION private.sincronizar_reserva_de_fatias()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  alvo_data date;
  linha record;
begin
  begin
    linha := coalesce(new, old);
    if TG_TABLE_NAME = 'instant_order_items' then
      select coalesce(linha.stock_service_date, (o.created_at at time zone 'America/Fortaleza')::date) into alvo_data
        from public.instant_orders o where o.id = linha.order_id;
      if alvo_data is not null then
        perform private.recalcular_reserva_de_fatias(linha.flavor_id, alvo_data);
        if TG_OP = 'UPDATE' and old.flavor_id is distinct from new.flavor_id then
          perform private.recalcular_reserva_de_fatias(old.flavor_id, alvo_data);
        end if;
      end if;
    else
      alvo_data := (linha.created_at at time zone 'America/Fortaleza')::date;
      perform private.recalcular_reserva_de_fatias(i.flavor_id, coalesce(i.stock_service_date, alvo_data))
        from public.instant_order_items i where i.order_id = linha.id;
    end if;
  exception when others then
    -- Nunca impedir uma venda por causa da contagem.
    raise warning 'reserva nao sincronizada: %', sqlerrm;
  end;
  return coalesce(new, old);
end;
$function$;
CREATE OR REPLACE FUNCTION private.release_instant_order_stock(target_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.flavor_availability availability
  set quantity_reserved = greatest(0, availability.quantity_reserved - requested.quantity),
      updated_at = now()
  from (
    select item.flavor_id, item.stock_service_date, sum(item.quantity)::integer quantity
    from public.instant_order_items item
    where item.order_id = target_order_id and item.status = 'reserved'
    group by item.flavor_id, item.stock_service_date
  ) requested
  where availability.flavor_id = requested.flavor_id
    and availability.service_date = coalesce(requested.stock_service_date, (now() at time zone 'America/Fortaleza')::date)
    and availability.quantity_available is not null;

  update public.instant_order_items
  set status = 'cancelled', updated_at = now()
  where order_id = target_order_id and status = 'reserved';
end;
$function$;

create or replace function private.refresh_instant_order_stock_for_payment(target_order_id uuid) returns void
language plpgsql security definer set search_path='' as $function$
declare reserved_ids uuid[]; conflicts jsonb;
begin
  if not exists(select 1 from public.instant_order_items i join public.instant_orders o on o.id=i.order_id
    where i.order_id=target_order_id and i.status='reserved'
      and coalesce(i.stock_service_date,(o.created_at at time zone 'America/Fortaleza')::date) <> (now() at time zone 'America/Fortaleza')::date) then return; end if;
  select array_agg(id) into reserved_ids from public.instant_order_items where order_id=target_order_id and status='reserved';
  perform private.release_instant_order_stock(target_order_id);
  update public.instant_order_items set status='selected',updated_at=now() where id=any(reserved_ids);
  conflicts := private.reserve_instant_order_stock(target_order_id);
  if jsonb_array_length(conflicts)>0 then raise exception 'O estoque atual nao comporta esta baixa. Confira o saldo disponivel hoje.'; end if;
end;
$function$;
revoke all on function private.refresh_instant_order_stock_for_payment(uuid) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.staff_update_instant_order(target_order_id uuid, next_status text, next_payment_url text DEFAULT NULL::text, next_payment_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, next_internal_notes text DEFAULT NULL::text, next_cancellation_reason text DEFAULT NULL::text)
 RETURNS instant_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_order public.instant_orders%rowtype;
  updated_order public.instant_orders%rowtype;
  conflicts jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  if next_status not in ('awaiting_confirmation','reserved','awaiting_payment','paid','preparing','ready','completed','cancelled','expired') then
    raise exception 'Status inválido';
  end if;
  select * into current_order from public.instant_orders where id = target_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if current_order.status in ('completed', 'cancelled') and next_status <> current_order.status then
    raise exception 'Pedido finalizado: use o fluxo de correcao auditada';
  end if;
  if next_status = 'cancelled' and length(btrim(coalesce(next_cancellation_reason, ''))) < 5 then
    raise exception 'Informe um motivo com pelo menos 5 caracteres';
  end if;

  if current_order.status = 'awaiting_confirmation'
     and next_status in ('reserved', 'awaiting_payment') then
    conflicts := private.reserve_instant_order_stock(current_order.id);
    if jsonb_array_length(conflicts) > 0 then
      raise exception 'Não há estoque suficiente para confirmar este pedido';
    end if;
  end if;

  if next_status in ('cancelled', 'expired')
     and current_order.status in ('reserved', 'awaiting_payment', 'preparing') then
    perform private.release_instant_order_stock(current_order.id);
  end if;

  if next_status = 'paid' and current_order.status in ('reserved', 'awaiting_payment', 'preparing') then
    perform private.refresh_instant_order_stock_for_payment(current_order.id);
    update public.flavor_availability availability
    set quantity_available = greatest(0, availability.quantity_available - requested.quantity),
        quantity_reserved = greatest(0, availability.quantity_reserved - requested.quantity),
        updated_at = now()
    from (
      select item.flavor_id, item.stock_service_date, sum(item.quantity)::integer quantity
      from public.instant_order_items item
      where item.order_id = current_order.id and item.status = 'reserved'
      group by item.flavor_id, item.stock_service_date
    ) requested
    where availability.flavor_id = requested.flavor_id
      and availability.service_date = coalesce(requested.stock_service_date, (now() at time zone 'America/Fortaleza')::date)
      and availability.quantity_available is not null;
    update public.instant_order_items set status = 'paid', updated_at = now()
      where order_id = current_order.id and status = 'reserved';
  end if;

  update public.instant_orders
  set status = next_status,
      payment_status = case
        when next_status = 'paid' then 'approved'
        when next_status = 'awaiting_payment' then 'pending'
        when next_status = 'expired' then 'expired'
        when next_status = 'cancelled' then 'cancelled'
        else payment_status end,
      payment_url = coalesce(nullif(btrim(next_payment_url), ''), payment_url),
      payment_expires_at = coalesce(next_payment_expires_at, payment_expires_at),
      internal_notes = coalesce(next_internal_notes, internal_notes),
      cancellation_reason = case when next_status in ('cancelled','expired')
        then coalesce(nullif(btrim(next_cancellation_reason), ''), cancellation_reason) else cancellation_reason end,
      reserved_until = case
        when next_status in ('reserved','awaiting_payment') then coalesce(reserved_until, now() + interval '15 minutes')
        when next_status in ('paid','preparing','ready','completed','cancelled','expired') then null
        else reserved_until end,
      paid_at = case when next_status = 'paid' then coalesce(paid_at, now()) else paid_at end,
      ready_at = case when next_status = 'ready' then coalesce(ready_at, now()) else ready_at end,
      completed_at = case when next_status = 'completed' then coalesce(completed_at, now()) else completed_at end,
      updated_by = (select auth.uid()), updated_at = now()
  where id = current_order.id returning * into updated_order;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'instant_order.status_changed', 'instant_order', updated_order.id::text,
    jsonb_build_object('from_status', current_order.status, 'status', next_status,
      'order_number', updated_order.order_number));
  return updated_order;
end;
$function$;
CREATE OR REPLACE FUNCTION private.finish_instant_order_item_batches(target_order_item_id uuid, next_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
            and batch.service_date = coalesce(item_row.stock_service_date, (order_row.created_at at time zone 'America/Fortaleza')::date)
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
