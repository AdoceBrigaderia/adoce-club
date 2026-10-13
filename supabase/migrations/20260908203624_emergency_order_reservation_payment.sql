-- Correcao emergencial: lotes sem horario, pagamento da equipe e separacao.
begin;
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
  target_order.pickup_requested_time := coalesce(target_order.pickup_requested_time, '23:59:59'::time);

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
    and (order_row.created_at at time zone 'America/Fortaleza')::date = availability.service_date
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
$function$
;
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
    update public.flavor_availability availability
    set quantity_available = greatest(0, availability.quantity_available - requested.quantity),
        quantity_reserved = greatest(0, availability.quantity_reserved - requested.quantity),
        updated_at = now()
    from (
      select item.flavor_id, sum(item.quantity)::integer quantity
      from public.instant_order_items item
      where item.order_id = current_order.id and item.status = 'reserved'
      group by item.flavor_id
    ) requested
    where availability.flavor_id = requested.flavor_id
      and availability.service_date = (now() at time zone 'America/Fortaleza')::date
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
$function$
;
CREATE OR REPLACE FUNCTION public.staff_confirm_instant_order_payment(target_order_id uuid, next_internal_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_order public.instant_orders%rowtype;
  linked_profile_id uuid;
  member_account_id uuid;
  member_track_id uuid;
  purchase_quantity integer := 0;
  reward_item public.instant_order_items%rowtype;
  reward_row public.rewards%rowtype;
  purchase_result jsonb := '{}'::jsonb;
  updated_order public.instant_orders%rowtype;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  select * into current_order from public.instant_orders where id = target_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if current_order.status not in ('reserved', 'awaiting_payment', 'preparing') then
    raise exception 'O pedido precisa estar reservado e aguardando pagamento';
  end if;

  linked_profile_id := private.link_instant_order_member(target_order_id);
  if linked_profile_id is not null then
    select membership.account_id, track.id into member_account_id, member_track_id
    from public.account_memberships membership
    join public.loyalty_tracks track on track.account_id = membership.account_id and track.kind = 'main'
    where membership.profile_id = linked_profile_id and membership.active and membership.is_primary;
  end if;

  select coalesce(sum(item.quantity), 0)::integer into purchase_quantity
  from public.instant_order_items item
  where item.order_id = target_order_id and not item.is_reward
    and item.status = 'reserved';

  if member_account_id is not null and purchase_quantity > 0 then
    purchase_result := public.staff_record_purchase(
      member_account_id,
      linked_profile_id,
      purchase_quantity::smallint,
      'instant-order:' || target_order_id::text || ':purchase',
      null
    );
  end if;

  select * into reward_item from public.instant_order_items
  where order_id = target_order_id and is_reward for update;
  if found then
    if member_track_id is null then
      raise exception 'Não foi possível vincular a fatia premiada ao Clube Adoce';
    end if;
    select * into reward_row from public.rewards
    where track_id = member_track_id and status = 'available'
    order by issued_at, id limit 1 for update;
    if not found then raise exception 'O cartão ainda não possui uma fatia premiada disponível'; end if;

    perform public.staff_redeem_group_reward(
      reward_row.id,
      linked_profile_id,
      reward_item.unit_price > 0,
      reward_item.unit_price,
      'instant-order:' || target_order_id::text || ':reward'
    );
    update public.instant_order_items set reward_id = reward_row.id, updated_at = now()
    where id = reward_item.id;
  end if;

  select * into updated_order from public.staff_update_instant_order(
    target_order_id,
    'paid',
    current_order.payment_url,
    current_order.payment_expires_at,
    coalesce(next_internal_notes, current_order.internal_notes),
    null
  );

  return jsonb_build_object(
    'order_id', updated_order.id,
    'order_number', updated_order.order_number,
    'status', updated_order.status,
    'member_recognized', member_account_id is not null,
    'stamps_added', case when member_account_id is not null then purchase_quantity else 0 end,
    'new_rewards', coalesce((purchase_result ->> 'new_rewards')::integer, 0),
    'reward_redeemed', reward_item.id is not null
  );
end;
$function$
;
revoke all on function public.staff_confirm_instant_order_payment(uuid,text) from public, anon;
grant execute on function public.staff_confirm_instant_order_payment(uuid,text) to authenticated;

create or replace function public.staff_confirm_instant_order_payment_and_prepare(target_order_id uuid, next_internal_notes text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare target public.instant_orders%rowtype; result jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
  select * into target from public.instant_orders where id = target_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if target.status = 'preparing' and target.payment_status = 'approved' then
    return jsonb_build_object('order_id',target.id,'status','preparing','already_confirmed',true);
  end if;
  if target.status = 'paid' and target.payment_status = 'approved' then
    result := jsonb_build_object('order_id',target.id);
  else
    result := public.staff_confirm_instant_order_payment(target_order_id,next_internal_notes);
  end if;
  perform public.staff_update_instant_order(target_order_id,'preparing',null,null,next_internal_notes,null);
  return result || jsonb_build_object('status','preparing');
end;
$function$;
revoke all on function public.staff_confirm_instant_order_payment_and_prepare(uuid,text) from public, anon;
grant execute on function public.staff_confirm_instant_order_payment_and_prepare(uuid,text) to authenticated;

-- Reconstroi apenas a alocacao que falta nas reservas abertas de hoje.
do $repair$
declare item record;
begin
  for item in select i.id from public.instant_order_items i join public.instant_orders o on o.id=i.order_id
    where i.status='reserved' and o.status in ('reserved','awaiting_payment','preparing')
      and (o.created_at at time zone 'America/Fortaleza')::date=(now() at time zone 'America/Fortaleza')::date
      and not exists(select 1 from private.instant_order_batch_allocations a where a.order_item_id=i.id and a.status='reserved')
  loop
    perform private.allocate_instant_order_item_batches(item.id);
    insert into public.audit_events(action,entity_type,entity_id,payload)
      values('instant_order.batch_reservation_repaired','instant_order_item',item.id::text,jsonb_build_object('migration','20260908203624'));
  end loop;
end;
$repair$;
commit;
