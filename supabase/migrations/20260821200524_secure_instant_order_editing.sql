begin;

-- Keep the legacy implementation closed. The browser calls a scoped facade
-- that adds store authorization before delegating to the proven routine.
revoke all on function public.staff_set_instant_order_reward_item(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.staff_set_instant_order_reward_item_scoped(
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
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso nao autorizado';
  end if;

  select * into current_order
  from public.instant_orders
  where id = target_order_id
  for update;
  if not found then raise exception 'Pedido nao encontrado'; end if;

  -- Legacy orders predate store_id in the ordering flow and remain staff-only.
  -- Every store-scoped order also requires the manage_orders capability.
  if current_order.store_id is not null
     and not private.can_manage_orders_at_store(current_order.store_id) then
    raise exception 'Sem permissao para editar pedidos desta loja';
  end if;

  return public.staff_set_instant_order_reward_item(target_order_id, target_flavor_id);
end;
$$;

revoke all on function public.staff_set_instant_order_reward_item_scoped(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.staff_set_instant_order_reward_item_scoped(uuid, uuid)
  to authenticated;

create or replace function public.staff_edit_instant_order_items(
  target_order_id uuid,
  requested_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.instant_orders%rowtype;
  requested_item jsonb;
  requested_sauce jsonb;
  flavor_row public.flavors%rowtype;
  availability_row public.flavor_availability%rowtype;
  inserted_item_id uuid;
  requested_quantity integer;
  requested_sauce_id uuid;
  resolved_sauce_name text;
  requested_unit integer;
  total_quantity integer := 0;
  item_status text;
  previous_items jsonb := '[]'::jsonb;
  loyalty_context jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso nao autorizado';
  end if;

  select * into current_order
  from public.instant_orders
  where id = target_order_id
  for update;
  if not found then raise exception 'Pedido nao encontrado'; end if;

  if current_order.store_id is not null
     and not private.can_manage_orders_at_store(current_order.store_id) then
    raise exception 'Sem permissao para editar pedidos desta loja';
  end if;
  if current_order.status not in ('awaiting_confirmation', 'reserved', 'awaiting_payment') then
    raise exception 'Este pedido nao pode mais ser editado';
  end if;
  if requested_items is null or jsonb_typeof(requested_items) <> 'array'
     or jsonb_array_length(requested_items) = 0 then
    raise exception 'O pedido precisa ter pelo menos uma fatia paga';
  end if;
  if (
    select count(*)
    from jsonb_array_elements(requested_items) entry
  ) <> (
    select count(distinct entry->>'flavor_id')
    from jsonb_array_elements(requested_items) entry
  ) then
    raise exception 'Cada sabor deve aparecer apenas uma vez no pedido';
  end if;

  for requested_item in select value from jsonb_array_elements(requested_items)
  loop
    requested_quantity := (requested_item->>'quantity')::integer;
    if requested_quantity < 1 or requested_quantity > 30 then
      raise exception 'Quantidade de fatias invalida';
    end if;
    total_quantity := total_quantity + requested_quantity;
    if total_quantity > 30 then
      raise exception 'O pedido aceita no maximo 30 fatias pagas';
    end if;

    select * into flavor_row
    from public.flavors
    where id = (requested_item->>'flavor_id')::uuid
      and active
      and coalesce(base_price, 0) > 0
    for share;
    if not found then raise exception 'Um dos sabores nao esta mais disponivel'; end if;

    if not (requested_item ? 'sauces')
       or jsonb_typeof(requested_item->'sauces') <> 'array'
       or jsonb_array_length(requested_item->'sauces') <> requested_quantity then
      raise exception 'Escolha uma opcao de calda para cada fatia';
    end if;

    for requested_sauce in select value from jsonb_array_elements(requested_item->'sauces')
    loop
      requested_sauce_id := nullif(requested_sauce->>'sauce_id', '')::uuid;
      if requested_sauce_id is not null and not exists (
        select 1 from public.order_sauces sauce
        where sauce.id = requested_sauce_id and sauce.active
      ) then
        raise exception 'Uma das caldas escolhidas nao esta mais disponivel';
      end if;
    end loop;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id', item.id,
    'flavor_id', item.flavor_id,
    'flavor_name', item.flavor_name,
    'quantity', item.quantity,
    'unit_price', item.unit_price,
    'sauces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'unit_number', choice.unit_number,
        'sauce_id', choice.sauce_id,
        'sauce_name', choice.sauce_name
      ) order by choice.unit_number)
      from public.instant_order_item_sauces choice
      where choice.order_item_id = item.id
    ), '[]'::jsonb)
  ) order by item.created_at), '[]'::jsonb)
  into previous_items
  from public.instant_order_items item
  where item.order_id = target_order_id and not item.is_reward
    and item.status not in ('cancelled', 'unavailable');

  if current_order.status in ('reserved', 'awaiting_payment') then
    update public.flavor_availability availability
    set quantity_reserved = greatest(0, availability.quantity_reserved - previous.quantity),
        updated_at = now()
    from (
      select item.flavor_id, sum(item.quantity)::integer quantity
      from public.instant_order_items item
      where item.order_id = target_order_id and not item.is_reward
        and item.status = 'reserved'
      group by item.flavor_id
    ) previous
    where availability.flavor_id = previous.flavor_id
      and availability.service_date = (now() at time zone 'America/Fortaleza')::date
      and availability.quantity_available is not null;
  end if;

  delete from public.instant_order_items
  where order_id = target_order_id and not is_reward;

  item_status := case
    when current_order.status in ('reserved', 'awaiting_payment') then 'reserved'
    else 'selected'
  end;

  for requested_item in select value from jsonb_array_elements(requested_items)
  loop
    requested_quantity := (requested_item->>'quantity')::integer;
    select * into flavor_row
    from public.flavors
    where id = (requested_item->>'flavor_id')::uuid
    for share;

    if item_status = 'reserved' then
      select * into availability_row
      from public.flavor_availability availability
      where availability.flavor_id = flavor_row.id
        and availability.service_date = (now() at time zone 'America/Fortaleza')::date
      for update;
      if not found
         or availability_row.status not in ('available', 'last_units', 'preorder_only')
         or availability_row.quantity_available is null
         or availability_row.quantity_available - availability_row.quantity_reserved < requested_quantity then
        raise exception 'Nao ha estoque suficiente de % para salvar a edicao', flavor_row.name;
      end if;
      update public.flavor_availability
      set quantity_reserved = quantity_reserved + requested_quantity,
          updated_at = now()
      where id = availability_row.id;
    end if;

    insert into public.instant_order_items(
      order_id, flavor_id, flavor_name, unit_price, quantity, status, is_reward
    ) values (
      target_order_id, flavor_row.id, flavor_row.name,
      flavor_row.base_price::numeric(10,2), requested_quantity, item_status, false
    ) returning id into inserted_item_id;

    requested_unit := 0;
    for requested_sauce in select value from jsonb_array_elements(requested_item->'sauces')
    loop
      requested_unit := requested_unit + 1;
      requested_sauce_id := nullif(requested_sauce->>'sauce_id', '')::uuid;
      if requested_sauce_id is null then
        resolved_sauce_name := 'Sem calda';
      else
        select name into resolved_sauce_name
        from public.order_sauces
        where id = requested_sauce_id and active;
      end if;
      insert into public.instant_order_item_sauces(
        order_item_id, unit_number, sauce_id, sauce_name
      ) values (
        inserted_item_id, requested_unit, requested_sauce_id, resolved_sauce_name
      );
    end loop;
  end loop;

  if exists (
    select 1 from public.instant_order_items
    where order_id = target_order_id and is_reward
  ) then
    loyalty_context := public.staff_instant_order_loyalty_context(target_order_id);
    if coalesce((loyalty_context->>'reward_choices')::integer, 0) < 1 then
      raise exception 'A edicao removeria a elegibilidade da fatia premiada';
    end if;
  end if;

  update public.instant_orders target
  set subtotal = totals.amount,
      total = totals.amount,
      updated_by = (select auth.uid()),
      updated_at = now()
  from (
    select coalesce(sum(item.quantity * item.unit_price), 0)::numeric(10,2) amount
    from public.instant_order_items item
    where item.order_id = target_order_id
      and item.status not in ('cancelled', 'unavailable')
  ) totals
  where target.id = target_order_id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()),
    'instant_order.items_edited',
    'instant_order',
    target_order_id::text,
    jsonb_build_object(
      'store_id', current_order.store_id,
      'order_number', current_order.order_number,
      'previous_items', previous_items,
      'requested_items', requested_items
    )
  );

  return jsonb_build_object(
    'updated', true,
    'order_id', target_order_id,
    'paid_quantity', total_quantity,
    'status', current_order.status
  );
end;
$$;

revoke all on function public.staff_edit_instant_order_items(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.staff_edit_instant_order_items(uuid, jsonb)
  to authenticated;

create or replace function public.staff_mark_existing_instant_order_item_reward(
  target_order_id uuid,
  target_order_item_id uuid,
  target_unit_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.instant_orders%rowtype;
  target_item public.instant_order_items%rowtype;
  existing_reward public.instant_order_items%rowtype;
  flavor_row public.flavors%rowtype;
  linked_profile_id uuid;
  member_track_id uuid;
  progress smallint := 0;
  purchase_quantity integer := 0;
  available_count integer := 0;
  reward_charge numeric(10,2) := 0;
  reward_item_id uuid;
  selected_sauce_id uuid;
  selected_sauce_name text := 'Sem calda';
  remaining_sauces jsonb := '[]'::jsonb;
  sauce_choice jsonb;
  item_status text;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso nao autorizado';
  end if;

  select * into current_order
  from public.instant_orders
  where id = target_order_id
  for update;
  if not found then raise exception 'Pedido nao encontrado'; end if;

  if current_order.store_id is not null
     and not private.can_manage_orders_at_store(current_order.store_id) then
    raise exception 'Sem permissao para editar pedidos desta loja';
  end if;
  if current_order.status not in ('awaiting_confirmation', 'reserved', 'awaiting_payment') then
    raise exception 'A fatia premiada precisa ser definida antes do pagamento';
  end if;

  select * into target_item
  from public.instant_order_items
  where id = target_order_item_id
    and order_id = target_order_id
    and not is_reward
    and status not in ('cancelled', 'unavailable')
  for update;
  if not found then raise exception 'Fatia do pedido nao encontrada'; end if;
  if target_unit_number < 1 or target_unit_number > target_item.quantity then
    raise exception 'Unidade da fatia invalida';
  end if;

  linked_profile_id := private.link_instant_order_member(target_order_id);
  select track.id, track.current_progress into member_track_id, progress
  from public.account_memberships membership
  join public.loyalty_tracks track
    on track.account_id = membership.account_id and track.kind = 'main'
  where membership.profile_id = linked_profile_id
    and membership.active and membership.is_primary;
  if member_track_id is null then
    raise exception 'Cliente nao identificado como membro do Clube Adoce';
  end if;

  select greatest(coalesce(sum(item.quantity), 0)::integer - 1, 0)
  into purchase_quantity
  from public.instant_order_items item
  where item.order_id = target_order_id and not item.is_reward
    and item.status not in ('cancelled', 'unavailable');
  select count(*)::integer into available_count
  from public.rewards reward
  where reward.track_id = member_track_id and reward.status = 'available';
  if available_count + ((progress + purchase_quantity) / 14) < 1 then
    raise exception 'As demais fatias pagas nao mantem esta premiacao elegivel';
  end if;

  select * into flavor_row
  from public.flavors
  where id = target_item.flavor_id and active
  for share;
  if not found then raise exception 'Sabor nao encontrado'; end if;
  reward_charge := greatest(coalesce(flavor_row.base_price, 0) - 16, 0)::numeric(10,2);

  select sauce_id, sauce_name
  into selected_sauce_id, selected_sauce_name
  from public.instant_order_item_sauces
  where order_item_id = target_item.id and unit_number = target_unit_number;
  selected_sauce_name := coalesce(selected_sauce_name, 'Sem calda');

  select coalesce(jsonb_agg(jsonb_build_object(
    'unit_number', choice.unit_number,
    'sauce_id', choice.sauce_id,
    'sauce_name', choice.sauce_name
  ) order by choice.unit_number), '[]'::jsonb)
  into remaining_sauces
  from public.instant_order_item_sauces choice
  where choice.order_item_id = target_item.id
    and choice.unit_number <> target_unit_number;

  select * into existing_reward
  from public.instant_order_items
  where order_id = target_order_id and is_reward
  for update;
  if found then
    if existing_reward.status = 'reserved' then
      update public.flavor_availability availability
      set quantity_reserved = greatest(0, availability.quantity_reserved - 1),
          updated_at = now()
      where availability.flavor_id = existing_reward.flavor_id
        and availability.service_date = (now() at time zone 'America/Fortaleza')::date
        and availability.quantity_available is not null;
    end if;
    delete from public.instant_order_items where id = existing_reward.id;
  end if;

  delete from public.instant_order_item_sauces where order_item_id = target_item.id;
  if target_item.quantity = 1 then
    delete from public.instant_order_items where id = target_item.id;
  else
    update public.instant_order_items
    set quantity = quantity - 1, updated_at = now()
    where id = target_item.id;

    for sauce_choice in select value from jsonb_array_elements(remaining_sauces)
    loop
      insert into public.instant_order_item_sauces(
        order_item_id, unit_number, sauce_id, sauce_name
      ) values (
        target_item.id,
        (sauce_choice->>'unit_number')::integer
          - case when (sauce_choice->>'unit_number')::integer > target_unit_number then 1 else 0 end,
        nullif(sauce_choice->>'sauce_id', '')::uuid,
        sauce_choice->>'sauce_name'
      );
    end loop;
  end if;

  item_status := case
    when current_order.status in ('reserved', 'awaiting_payment') then 'reserved'
    else 'selected'
  end;
  insert into public.instant_order_items(
    order_id, flavor_id, flavor_name, unit_price, quantity, status, is_reward
  ) values (
    target_order_id, flavor_row.id, flavor_row.name,
    reward_charge, 1, item_status, true
  ) returning id into reward_item_id;

  insert into public.instant_order_item_sauces(
    order_item_id, unit_number, sauce_id, sauce_name
  ) values (
    reward_item_id, 1, selected_sauce_id, selected_sauce_name
  );

  update public.instant_orders target
  set subtotal = totals.amount,
      total = totals.amount,
      updated_by = (select auth.uid()),
      updated_at = now()
  from (
    select coalesce(sum(item.quantity * item.unit_price), 0)::numeric(10,2) amount
    from public.instant_order_items item
    where item.order_id = target_order_id
      and item.status not in ('cancelled', 'unavailable')
  ) totals
  where target.id = target_order_id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()),
    'instant_order.existing_item_marked_reward',
    'instant_order',
    target_order_id::text,
    jsonb_build_object(
      'store_id', current_order.store_id,
      'order_number', current_order.order_number,
      'source_item_id', target_item.id,
      'source_unit_number', target_unit_number,
      'flavor_id', flavor_row.id,
      'flavor_name', flavor_row.name,
      'premium_difference', reward_charge
    )
  );

  return jsonb_build_object(
    'selected', true,
    'used_existing_item', true,
    'flavor_id', flavor_row.id,
    'flavor_name', flavor_row.name,
    'premium_difference', reward_charge,
    'status', item_status
  );
end;
$$;

revoke all on function public.staff_mark_existing_instant_order_item_reward(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.staff_mark_existing_instant_order_item_reward(uuid, uuid, integer)
  to authenticated;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.staff_set_instant_order_reward_item_scoped(uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.staff_edit_instant_order_items(uuid,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.staff_mark_existing_instant_order_item_reward(uuid,uuid,integer)',
    'EXECUTE'
  ) then
    raise exception 'RPCs de edicao de pedido nao podem ser executadas por anon';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.staff_set_instant_order_reward_item_scoped(uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.staff_set_instant_order_reward_item(uuid,uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.staff_edit_instant_order_items(uuid,jsonb)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.staff_mark_existing_instant_order_item_reward(uuid,uuid,integer)',
    'EXECUTE'
  ) then
    raise exception 'RPCs de edicao precisam estar disponiveis para a equipe autenticada';
  end if;
end;
$$;

commit;
