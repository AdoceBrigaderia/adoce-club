begin;

create or replace function private.current_standard_slice_price()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select min(f.base_price)
      from public.flavors f
      where f.active
        and f.base_price > 0
        and coalesce(f.category, '') <> 'premium'
    ),
    (
      select min(f.base_price)
      from public.flavors f
      where f.active and f.base_price > 0
    ),
    0
  )::numeric(10,2);
$$;

revoke all on function private.current_standard_slice_price() from public, anon, authenticated;

create or replace function public.public_quote_instant_order(
  requested_items jsonb,
  requested_reward jsonb default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requested_line_count integer := 0;
  matched_line_count integer := 0;
  total_quantity integer := 0;
  subtotal numeric(10,2) := 0;
  reward_upgrade numeric(10,2) := 0;
  standard_price numeric(10,2) := private.current_standard_slice_price();
  line_items jsonb := '[]'::jsonb;
  reward_flavor public.flavors%rowtype;
  member_track_id uuid;
  member_progress integer := 0;
  available_reward_count integer := 0;
begin
  if jsonb_typeof(requested_items) <> 'array'
     or jsonb_array_length(requested_items) = 0 then
    raise exception 'Inclua pelo menos uma fatia';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(requested_items) entry
    where coalesce(entry->>'flavor_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(entry->>'quantity', '') !~ '^[0-9]+$'
       or (entry->>'quantity')::integer not between 1 and 30
  ) then
    raise exception 'Revise os sabores e quantidades do pedido';
  end if;

  with requested as (
    select
      (entry->>'flavor_id')::uuid as flavor_id,
      sum((entry->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(requested_items) entry
    group by (entry->>'flavor_id')::uuid
  )
  select count(*), coalesce(sum(quantity), 0)::integer
  into requested_line_count, total_quantity
  from requested;

  if total_quantity < 1 or total_quantity > 60 then
    raise exception 'O pedido deve ter entre 1 e 60 fatias';
  end if;

  with requested as (
    select
      (entry->>'flavor_id')::uuid as flavor_id,
      sum((entry->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(requested_items) entry
    group by (entry->>'flavor_id')::uuid
  ), validated as (
    select
      requested.flavor_id,
      requested.quantity,
      flavor.name,
      flavor.base_price,
      availability.quantity_available,
      coalesce(availability.quantity_reserved, 0) as quantity_reserved
    from requested
    join public.flavors flavor
      on flavor.id = requested.flavor_id
     and flavor.active
     and flavor.base_price > 0
    join public.flavor_availability availability
      on availability.flavor_id = flavor.id
     and availability.service_date = (now() at time zone 'America/Fortaleza')::date
     and availability.status in ('available', 'last_units', 'preorder_only')
    where availability.quantity_available is null
       or availability.quantity_available - coalesce(availability.quantity_reserved, 0) >= requested.quantity
  )
  select
    count(*),
    coalesce(round(sum(quantity * base_price), 2), 0)::numeric(10,2),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'flavor_id', flavor_id,
          'flavor_name', name,
          'quantity', quantity,
          'unit_price', base_price,
          'line_total', round(quantity * base_price, 2)
        ) order by name
      ),
      '[]'::jsonb
    )
  into matched_line_count, subtotal, line_items
  from validated;

  if matched_line_count <> requested_line_count then
    raise exception 'A disponibilidade ou o preço de um sabor mudou. Atualize o pedido';
  end if;

  if requested_reward is not null and requested_reward <> 'null'::jsonb then
    if jsonb_typeof(requested_reward) <> 'object'
       or coalesce(requested_reward->>'flavor_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Escolha um sabor válido para sua fatia-presente';
    end if;

    if (select auth.uid()) is null then
      raise exception 'Entre no Clube Adoce para usar uma fatia-presente';
    end if;

    select track.id, track.current_progress
    into member_track_id, member_progress
    from public.account_memberships membership
    join public.loyalty_accounts account
      on account.id = membership.account_id and account.active
    join public.loyalty_tracks track
      on track.account_id = account.id and track.kind = 'main'
    where membership.profile_id = (select auth.uid())
      and membership.active
      and membership.is_primary
    limit 1;

    if member_track_id is null then
      raise exception 'Seu cartão do Clube Adoce precisa ser revisado';
    end if;

    select count(*)::integer
    into available_reward_count
    from public.rewards reward
    where reward.track_id = member_track_id
      and reward.status = 'available';

    if available_reward_count + ((member_progress + total_quantity) / 14) < 1 then
      raise exception 'Este pedido ainda não libera uma fatia-presente';
    end if;

    select flavor.*
    into reward_flavor
    from public.flavors flavor
    join public.flavor_availability availability
      on availability.flavor_id = flavor.id
     and availability.service_date = (now() at time zone 'America/Fortaleza')::date
     and availability.status in ('available', 'last_units', 'preorder_only')
    where flavor.id = (requested_reward->>'flavor_id')::uuid
      and flavor.active
      and flavor.base_price > 0
      and (
        availability.quantity_available is null
        or availability.quantity_available - coalesce(availability.quantity_reserved, 0) >= 1
      )
    limit 1;

    if reward_flavor.id is null then
      raise exception 'O sabor da fatia-presente não está mais disponível';
    end if;

    reward_upgrade := greatest(reward_flavor.base_price - standard_price, 0)::numeric(10,2);
  end if;

  return jsonb_build_object(
    'quantity', total_quantity,
    'subtotal', subtotal,
    'standard_slice_price', standard_price,
    'reward_upgrade', reward_upgrade,
    'total', round(subtotal + reward_upgrade, 2),
    'items', line_items,
    'server_calculated', true
  );
end;
$$;

revoke all on function public.public_quote_instant_order(jsonb,jsonb) from public;
grant execute on function public.public_quote_instant_order(jsonb,jsonb) to anon, authenticated;

create or replace function public.submit_instant_order_v5(
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_notes text default '',
  requested_payment_method text default 'pix',
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
begin
  if not exists (
    select 1
    from public.payment_methods method
    where method.code = requested_payment_method
      and method.active
      and method.customer_selectable
  ) then
    raise exception 'Escolha uma forma de pagamento disponível para pedidos on-line';
  end if;

  perform public.public_quote_instant_order(requested_items, requested_reward);

  if requested_reward is not null and requested_reward <> 'null'::jsonb then
    response := public.submit_instant_order_v3(
      requested_customer_name,
      requested_customer_phone,
      requested_items,
      requested_notes,
      requested_reward
    );
  else
    response := public.submit_instant_order_v4(
      requested_customer_name,
      requested_customer_phone,
      requested_items,
      requested_notes
    );
  end if;

  if not coalesce((response->>'accepted')::boolean, false) then
    return response;
  end if;

  select * into created_order
  from public.instant_orders
  where order_number = response->>'order_number'
  for update;

  created_order := private.snapshot_instant_order_payment(
    created_order.id,
    requested_payment_method
  );

  return response || jsonb_build_object(
    'payment_method', created_order.payment_method_code,
    'payment_method_label', created_order.payment_method_label,
    'subtotal', created_order.subtotal,
    'total', created_order.total,
    'gross_amount', created_order.gross_amount,
    'payment_fee_amount', created_order.payment_fee_amount,
    'net_amount', created_order.net_amount,
    'server_calculated', true
  );
end;
$$;

revoke all on function public.submit_instant_order_v5(text,text,jsonb,text,text,jsonb) from public;
grant execute on function public.submit_instant_order_v5(text,text,jsonb,text,text,jsonb) to anon, authenticated;

commit;
