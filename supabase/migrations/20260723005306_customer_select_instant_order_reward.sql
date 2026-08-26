-- Permite que o proprio membro autenticado escolha a fatia-presente e a calda.
-- O resgate e os carimbos continuam sendo efetivados somente ao confirmar o pagamento.
create or replace function public.member_instant_order_loyalty_preview(
  requested_phone text,
  requested_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_progress smallint;
  available_count integer := 0;
  safe_quantity integer := greatest(0, least(coalesce(requested_quantity, 0), 30));
  projected_total integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Entre no Clube Adoce para consultar seus carimbos';
  end if;
  select track.current_progress into member_progress
  from public.profiles profile
  join public.account_memberships membership
    on membership.profile_id = profile.id and membership.active and membership.is_primary
  join public.loyalty_accounts account
    on account.id = membership.account_id and account.active
  join public.loyalty_tracks track
    on track.account_id = account.id and track.kind = 'main'
  where profile.id = (select auth.uid()) and profile.active
    and right(regexp_replace(coalesce(profile.phone_e164, ''), '\D', '', 'g'), 11) =
        right(regexp_replace(coalesce(requested_phone, ''), '\D', '', 'g'), 11);
  if member_progress is null then return jsonb_build_object('recognized', false); end if;
  select count(*)::integer into available_count
  from public.rewards reward
  join public.loyalty_tracks track on track.id = reward.track_id
  join public.account_memberships membership on membership.account_id = track.account_id
  where membership.profile_id = (select auth.uid())
    and membership.active and membership.is_primary
    and track.kind = 'main' and reward.status = 'available';
  projected_total := member_progress + safe_quantity;
  return jsonb_build_object(
    'recognized', true,
    'current_progress', member_progress,
    'purchase_quantity', safe_quantity,
    'projected_progress', projected_total % 14,
    'projected_new_rewards', projected_total / 14,
    'available_rewards', available_count,
    'reward_choices', available_count + (projected_total / 14),
    'will_unlock_reward', projected_total >= 14
  );
end;
$$;
revoke all on function public.member_instant_order_loyalty_preview(text,integer)
  from public, anon;
grant execute on function public.member_instant_order_loyalty_preview(text,integer)
  to authenticated;

create or replace function public.submit_instant_order_v3(
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_notes text default '',
  requested_reward jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  response jsonb;
  created_order public.instant_orders%rowtype;
  member_track_id uuid;
  member_progress smallint := 0;
  purchase_quantity integer := 0;
  available_count integer := 0;
  reward_flavor public.flavors%rowtype;
  reward_availability public.flavor_availability%rowtype;
  reward_item_id uuid;
  reward_sauce_id uuid;
  reward_sauce_name text := 'Sem calda';
  reward_charge numeric(10,2) := 0;
  reward_status text := 'selected';
begin
  response := public.submit_instant_order_v2(
    requested_customer_name,
    requested_customer_phone,
    requested_items,
    requested_notes
  );
  if not coalesce((response->>'accepted')::boolean, false) or requested_reward is null then
    return response;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Entre no Clube Adoce para escolher sua fatia-presente';
  end if;

  select * into created_order
  from public.instant_orders target
  where target.order_number = response->>'order_number'
  for update;
  if created_order.profile_id is distinct from (select auth.uid()) then
    raise exception 'Confirme o WhatsApp cadastrado no seu Clube Adoce';
  end if;

  select track.id, track.current_progress
  into member_track_id, member_progress
  from public.account_memberships membership
  join public.loyalty_accounts account
    on account.id = membership.account_id and account.active
  join public.loyalty_tracks track
    on track.account_id = account.id and track.kind = 'main'
  where membership.profile_id = created_order.profile_id
    and membership.active and membership.is_primary;
  if member_track_id is null then
    raise exception 'Seu cartão do Clube Adoce precisa ser revisado antes do resgate';
  end if;

  select coalesce(sum(item.quantity), 0)::integer into purchase_quantity
  from public.instant_order_items item
  where item.order_id = created_order.id and not item.is_reward
    and item.status not in ('cancelled', 'unavailable');
  select count(*)::integer into available_count
  from public.rewards reward
  where reward.track_id = member_track_id and reward.status = 'available';
  if available_count + ((member_progress + purchase_quantity) / 14) < 1 then
    raise exception 'Esta compra ainda não libera uma fatia-presente';
  end if;

  select * into reward_flavor
  from public.flavors flavor
  where flavor.id = (requested_reward->>'flavor_id')::uuid and flavor.active;
  if not found then raise exception 'Escolha um sabor disponível para sua fatia-presente'; end if;
  reward_charge := greatest(coalesce(reward_flavor.base_price, 0) - 16, 0)::numeric(10,2);

  select * into reward_availability
  from public.flavor_availability availability
  where availability.flavor_id = reward_flavor.id
    and availability.service_date = (now() at time zone 'America/Fortaleza')::date
  for update;
  if not found or reward_availability.status not in ('available', 'last_units', 'preorder_only')
     or reward_availability.quantity_available is null
     or reward_availability.quantity_available - reward_availability.quantity_reserved < 1 then
    raise exception 'Esse sabor acabou agora. Escolha outro para sua fatia-presente';
  end if;

  if created_order.status in ('reserved', 'awaiting_payment') then
    reward_status := 'reserved';
    update public.flavor_availability
    set quantity_reserved = quantity_reserved + 1, updated_at = now()
    where id = reward_availability.id;
  end if;

  insert into public.instant_order_items(
    order_id, flavor_id, flavor_name, unit_price, quantity, status, is_reward
  ) values (
    created_order.id, reward_flavor.id, reward_flavor.name, reward_charge, 1, reward_status, true
  ) returning id into reward_item_id;

  if nullif(requested_reward->>'sauce_id', '') is not null then
    reward_sauce_id := (requested_reward->>'sauce_id')::uuid;
    select sauce.name into reward_sauce_name
    from public.order_sauces sauce
    where sauce.id = reward_sauce_id and sauce.active;
    if reward_sauce_name is null then
      raise exception 'A calda escolhida para a fatia-presente acabou agora';
    end if;
  end if;
  insert into public.instant_order_item_sauces(
    order_item_id, unit_number, sauce_id, sauce_name
  ) values (reward_item_id, 1, reward_sauce_id, reward_sauce_name);

  update public.instant_orders target
  set subtotal = totals.amount, total = totals.amount, updated_at = now()
  from (
    select coalesce(sum(item.quantity * item.unit_price), 0)::numeric(10,2) amount
    from public.instant_order_items item
    where item.order_id = created_order.id and item.status not in ('cancelled', 'unavailable')
  ) totals
  where target.id = created_order.id;

  return response || jsonb_build_object(
    'total', coalesce((response->>'total')::numeric, 0) + reward_charge,
    'reward_requested', true,
    'reward_flavor_name', reward_flavor.name,
    'reward_sauce_name', reward_sauce_name,
    'reward_upgrade', reward_charge
  );
end;
$$;

revoke all on function public.submit_instant_order_v3(text,text,jsonb,text,jsonb)
  from public, anon;
grant execute on function public.submit_instant_order_v3(text,text,jsonb,text,jsonb)
  to authenticated;
