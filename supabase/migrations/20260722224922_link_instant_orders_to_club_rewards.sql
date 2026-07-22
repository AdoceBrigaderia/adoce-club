-- Liga pedidos de fatias ao Clube Adoce pelo celular, antecipa a recompensa
-- e mantém carimbos, resgate e estoque na mesma transação de pagamento.

alter table public.instant_order_items
  drop constraint if exists instant_order_items_unit_price_check;
alter table public.instant_order_items
  add constraint instant_order_items_unit_price_check check (unit_price >= 0),
  add column if not exists is_reward boolean not null default false,
  add column if not exists reward_id uuid references public.rewards(id) on delete set null;

alter table public.instant_order_items
  drop constraint if exists instant_order_items_order_id_flavor_id_key;
create unique index if not exists instant_order_items_regular_flavor_unique
  on public.instant_order_items(order_id, flavor_id) where not is_reward;

create unique index if not exists instant_order_items_one_reward_per_order
  on public.instant_order_items(order_id) where is_reward;
create index if not exists instant_orders_profile_created_idx
  on public.instant_orders(profile_id, created_at desc) where profile_id is not null;

create or replace function private.attach_instant_order_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_id is null and nullif(regexp_replace(coalesce(new.customer_phone, ''), '\D', '', 'g'), '') is not null then
    select profile.id into new.profile_id
    from public.profiles profile
    where profile.active
      and right(regexp_replace(coalesce(profile.phone_e164, ''), '\D', '', 'g'), 11) =
          right(regexp_replace(coalesce(new.customer_phone, ''), '\D', '', 'g'), 11)
    limit 1;
  end if;
  return new;
end;
$$;
revoke all on function private.attach_instant_order_profile() from public, anon, authenticated;

drop trigger if exists instant_order_attach_profile on public.instant_orders;
create trigger instant_order_attach_profile
before insert or update of customer_phone, profile_id on public.instant_orders
for each row execute function private.attach_instant_order_profile();

update public.instant_orders target
set profile_id = profile.id, updated_at = now()
from public.profiles profile
where target.profile_id is null
  and profile.active
  and right(regexp_replace(coalesce(profile.phone_e164, ''), '\D', '', 'g'), 11) =
      right(regexp_replace(coalesce(target.customer_phone, ''), '\D', '', 'g'), 11);

create or replace function private.link_instant_order_member(target_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_profile_id uuid;
begin
  update public.instant_orders target
  set profile_id = profile.id, updated_at = now()
  from public.profiles profile
  where target.id = target_order_id
    and target.profile_id is null
    and profile.active
    and right(regexp_replace(coalesce(profile.phone_e164, ''), '\D', '', 'g'), 11) =
        right(regexp_replace(coalesce(target.customer_phone, ''), '\D', '', 'g'), 11)
  returning target.profile_id into linked_profile_id;

  if linked_profile_id is null then
    select profile_id into linked_profile_id
    from public.instant_orders where id = target_order_id;
  end if;
  return linked_profile_id;
end;
$$;
revoke all on function private.link_instant_order_member(uuid) from public, anon, authenticated;

create or replace function public.staff_instant_order_loyalty_context(target_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_profile_id uuid;
  member_name text;
  member_account_id uuid;
  member_track_id uuid;
  progress smallint := 0;
  available_count integer := 0;
  purchase_quantity integer := 0;
  projected_rewards integer := 0;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  if not exists (select 1 from public.instant_orders where id = target_order_id) then
    raise exception 'Pedido não encontrado';
  end if;

  linked_profile_id := private.link_instant_order_member(target_order_id);
  select coalesce(sum(item.quantity), 0)::integer into purchase_quantity
  from public.instant_order_items item
  where item.order_id = target_order_id and not item.is_reward
    and item.status not in ('cancelled', 'unavailable');

  if linked_profile_id is null then
    return jsonb_build_object(
      'recognized', false,
      'purchase_quantity', purchase_quantity,
      'message', 'Este celular ainda não está vinculado a um membro do Clube Adoce.'
    );
  end if;

  select profile.full_name, membership.account_id, track.id, track.current_progress
  into member_name, member_account_id, member_track_id, progress
  from public.profiles profile
  join public.account_memberships membership
    on membership.profile_id = profile.id and membership.active and membership.is_primary
  join public.loyalty_accounts account
    on account.id = membership.account_id and account.active
  join public.loyalty_tracks track
    on track.account_id = account.id and track.kind = 'main'
  where profile.id = linked_profile_id;

  if member_account_id is null then
    return jsonb_build_object(
      'recognized', false,
      'purchase_quantity', purchase_quantity,
      'message', 'O cadastro foi localizado, mas o cartão do Clube precisa ser revisado.'
    );
  end if;

  select count(*)::integer into available_count
  from public.rewards reward
  where reward.track_id = member_track_id and reward.status = 'available';
  projected_rewards := (progress + purchase_quantity) / 14;

  return jsonb_build_object(
    'recognized', true,
    'profile_id', linked_profile_id,
    'account_id', member_account_id,
    'member_name', member_name,
    'current_progress', progress,
    'purchase_quantity', purchase_quantity,
    'projected_progress', (progress + purchase_quantity) % 14,
    'projected_new_rewards', projected_rewards,
    'available_rewards', available_count,
    'reward_choices', available_count + projected_rewards,
    'will_unlock_reward', projected_rewards > 0
  );
end;
$$;
revoke all on function public.staff_instant_order_loyalty_context(uuid) from public, anon;
grant execute on function public.staff_instant_order_loyalty_context(uuid) to authenticated;

create or replace function public.staff_set_instant_order_reward_item(
  target_order_id uuid,
  target_flavor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.instant_orders%rowtype;
  linked_profile_id uuid;
  member_track_id uuid;
  progress smallint := 0;
  purchase_quantity integer := 0;
  available_count integer := 0;
  flavor_row public.flavors%rowtype;
  availability_row public.flavor_availability%rowtype;
  existing_item public.instant_order_items%rowtype;
  reward_charge numeric(10,2) := 0;
  item_status text := 'selected';
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  select * into current_order from public.instant_orders where id = target_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if current_order.status not in ('awaiting_confirmation', 'reserved', 'awaiting_payment') then
    raise exception 'A fatia premiada precisa ser escolhida antes de confirmar o pagamento';
  end if;

  linked_profile_id := private.link_instant_order_member(target_order_id);
  select track.id, track.current_progress into member_track_id, progress
  from public.account_memberships membership
  join public.loyalty_tracks track on track.account_id = membership.account_id and track.kind = 'main'
  where membership.profile_id = linked_profile_id and membership.active and membership.is_primary;
  if member_track_id is null then raise exception 'Cliente não identificado como membro do Clube Adoce'; end if;

  select coalesce(sum(item.quantity), 0)::integer into purchase_quantity
  from public.instant_order_items item
  where item.order_id = target_order_id and not item.is_reward
    and item.status not in ('cancelled', 'unavailable');
  select count(*)::integer into available_count
  from public.rewards reward where reward.track_id = member_track_id and reward.status = 'available';
  if available_count + ((progress + purchase_quantity) / 14) < 1 then
    raise exception 'Esta compra ainda não libera uma fatia premiada';
  end if;

  select * into flavor_row from public.flavors
  where id = target_flavor_id and active for share;
  if not found then raise exception 'Sabor não encontrado'; end if;
  reward_charge := greatest(coalesce(flavor_row.base_price, 0) - 16, 0)::numeric(10,2);

  select * into existing_item from public.instant_order_items
  where order_id = target_order_id and is_reward for update;
  if found and existing_item.status = 'reserved' then
    update public.flavor_availability availability
    set quantity_reserved = greatest(0, availability.quantity_reserved - 1), updated_at = now()
    where availability.flavor_id = existing_item.flavor_id
      and availability.service_date = (now() at time zone 'America/Fortaleza')::date
      and availability.quantity_available is not null;
  end if;
  delete from public.instant_order_items where order_id = target_order_id and is_reward;

  select * into availability_row from public.flavor_availability availability
  where availability.flavor_id = target_flavor_id
    and availability.service_date = (now() at time zone 'America/Fortaleza')::date
  for update;
  if not found or availability_row.status not in ('available', 'last_units', 'preorder_only')
     or availability_row.quantity_available is null
     or availability_row.quantity_available - availability_row.quantity_reserved < 1 then
    raise exception 'Este sabor não possui unidade disponível para a fatia premiada';
  end if;

  if current_order.status in ('reserved', 'awaiting_payment') then
    item_status := 'reserved';
    update public.flavor_availability
    set quantity_reserved = quantity_reserved + 1, updated_at = now()
    where id = availability_row.id;
  end if;

  insert into public.instant_order_items(
    order_id, flavor_id, flavor_name, unit_price, quantity, status, is_reward
  ) values (
    target_order_id, flavor_row.id, flavor_row.name, reward_charge, 1, item_status, true
  );

  update public.instant_orders target
  set subtotal = totals.amount, total = totals.amount, updated_by = (select auth.uid()), updated_at = now()
  from (
    select coalesce(sum(item.quantity * item.unit_price), 0)::numeric(10,2) amount
    from public.instant_order_items item
    where item.order_id = target_order_id and item.status not in ('cancelled', 'unavailable')
  ) totals
  where target.id = target_order_id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'instant_order.reward_selected', 'instant_order', target_order_id::text,
    jsonb_build_object('flavor_id', flavor_row.id, 'flavor_name', flavor_row.name,
      'premium_difference', reward_charge));

  return jsonb_build_object(
    'selected', true,
    'flavor_id', flavor_row.id,
    'flavor_name', flavor_row.name,
    'premium_difference', reward_charge,
    'status', item_status
  );
end;
$$;
revoke all on function public.staff_set_instant_order_reward_item(uuid,uuid) from public, anon;
grant execute on function public.staff_set_instant_order_reward_item(uuid,uuid) to authenticated;

-- Um sabor pode aparecer como item comprado e como fatia premiada. As rotinas
-- abaixo somam as duas linhas antes de alterar o estoque, evitando baixa parcial.
create or replace function private.release_instant_order_stock(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.flavor_availability availability
  set quantity_reserved = greatest(0, availability.quantity_reserved - requested.quantity),
      updated_at = now()
  from (
    select item.flavor_id, sum(item.quantity)::integer quantity
    from public.instant_order_items item
    where item.order_id = target_order_id and item.status = 'reserved'
    group by item.flavor_id
  ) requested
  where availability.flavor_id = requested.flavor_id
    and availability.service_date = (now() at time zone 'America/Fortaleza')::date
    and availability.quantity_available is not null;

  update public.instant_order_items
  set status = 'cancelled', updated_at = now()
  where order_id = target_order_id and status = 'reserved';
end;
$$;
revoke all on function private.release_instant_order_stock(uuid) from public, anon, authenticated;

create or replace function public.staff_update_instant_order(
  target_order_id uuid,
  next_status text,
  next_payment_url text default null,
  next_payment_expires_at timestamptz default null,
  next_internal_notes text default null,
  next_cancellation_reason text default null
)
returns public.instant_orders
language plpgsql
security definer
set search_path = ''
as $$
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

  if current_order.status = 'awaiting_confirmation'
     and next_status in ('reserved', 'awaiting_payment') then
    conflicts := private.reserve_instant_order_stock(current_order.id);
    if jsonb_array_length(conflicts) > 0 then
      raise exception 'Não há estoque suficiente para confirmar este pedido';
    end if;
  end if;

  if next_status in ('cancelled', 'expired')
     and current_order.status in ('reserved', 'awaiting_payment') then
    perform private.release_instant_order_stock(current_order.id);
  end if;

  if next_status = 'paid' and current_order.status in ('reserved', 'awaiting_payment') then
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
$$;
revoke all on function public.staff_update_instant_order(uuid,text,text,timestamptz,text,text)
  from public, anon, authenticated;
grant execute on function public.staff_update_instant_order(uuid,text,text,timestamptz,text,text)
  to authenticated;

create or replace function public.staff_confirm_instant_order_payment(
  target_order_id uuid,
  next_internal_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  if current_order.status not in ('reserved', 'awaiting_payment') then
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
$$;
revoke all on function public.staff_confirm_instant_order_payment(uuid,text) from public, anon;
grant execute on function public.staff_confirm_instant_order_payment(uuid,text) to authenticated;

insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
select null, 'instant_order.member_backfilled', 'instant_order', target.id::text,
  jsonb_build_object('order_number', target.order_number, 'profile_id', target.profile_id)
from public.instant_orders target
where target.profile_id is not null
  and not exists (
    select 1 from public.audit_events audit
    where audit.action = 'instant_order.member_backfilled'
      and audit.entity_id = target.id::text
  );
