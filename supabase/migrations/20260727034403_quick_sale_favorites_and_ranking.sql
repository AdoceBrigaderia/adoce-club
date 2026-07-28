begin;

create table if not exists public.staff_quick_sale_favorites (
  staff_profile_id uuid not null references public.profiles(id) on delete cascade,
  flavor_id uuid not null references public.flavors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (staff_profile_id, flavor_id)
);

alter table public.staff_quick_sale_favorites enable row level security;
revoke all on table public.staff_quick_sale_favorites from public, anon, authenticated;
grant all on table public.staff_quick_sale_favorites to service_role;

create or replace function public.staff_set_quick_sale_favorite(
  target_flavor_id uuid,
  favorite boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid := (select auth.uid());
  flavor_name text;
begin
  if current_profile_id is null
     or not private.staff_has_any_capability('sell') then
    raise exception 'Voce nao possui permissao para organizar a venda rapida';
  end if;

  select flavor.name into flavor_name
  from public.flavors flavor
  where flavor.id = target_flavor_id
    and flavor.active;

  if flavor_name is null then
    raise exception 'Produto nao encontrado ou inativo';
  end if;

  if coalesce(favorite, true) then
    insert into public.staff_quick_sale_favorites (
      staff_profile_id,
      flavor_id
    ) values (
      current_profile_id,
      target_flavor_id
    )
    on conflict (staff_profile_id, flavor_id) do nothing;
  else
    delete from public.staff_quick_sale_favorites
    where staff_profile_id = current_profile_id
      and flavor_id = target_flavor_id;
  end if;

  return jsonb_build_object(
    'flavor_id', target_flavor_id,
    'flavor_name', flavor_name,
    'favorite', coalesce(favorite, true),
    'updated_at', now()
  );
end;
$$;

revoke all on function public.staff_set_quick_sale_favorite(uuid,boolean)
  from public, anon;
grant execute on function public.staff_set_quick_sale_favorite(uuid,boolean)
  to authenticated;

create or replace function public.staff_get_quick_sale_catalog(
  service_date date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_date date := coalesce(
    staff_get_quick_sale_catalog.service_date,
    (now() at time zone 'America/Fortaleza')::date
  );
  current_profile_id uuid := (select auth.uid());
  result jsonb;
begin
  if current_profile_id is null
     or not private.staff_has_any_capability('sell') then
    raise exception 'Voce nao possui permissao para vender';
  end if;

  with sales_30d as (
    select
      item.flavor_id,
      coalesce(sum(item.quantity), 0)::integer as sales_count_30d
    from public.instant_order_items item
    join public.instant_orders orders
      on orders.id = item.order_id
    where orders.created_at >= now() - interval '30 days'
      and (
        orders.payment_status = 'approved'
        or orders.status in ('paid', 'preparing', 'ready', 'completed')
      )
      and item.status not in ('cancelled', 'unavailable')
    group by item.flavor_id
  ), available_flavors as (
    select
      flavor.id,
      flavor.name,
      flavor.base_price,
      flavor.image_path,
      greatest(
        0,
        coalesce(availability.quantity_available, 0)
          - coalesce(availability.quantity_reserved, 0)
      )::integer as remaining,
      (favorite.flavor_id is not null) as is_favorite,
      coalesce(sales.sales_count_30d, 0)::integer as sales_count_30d
    from public.flavors flavor
    left join public.flavor_availability availability
      on availability.flavor_id = flavor.id
     and availability.service_date = target_date
    left join public.staff_quick_sale_favorites favorite
      on favorite.staff_profile_id = current_profile_id
     and favorite.flavor_id = flavor.id
    left join sales_30d sales
      on sales.flavor_id = flavor.id
    where flavor.active
      and flavor.base_price > 0
  )
  select jsonb_build_object(
    'service_date', target_date,
    'flavors', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'name', item.name,
          'base_price', item.base_price,
          'image_path', item.image_path,
          'remaining', item.remaining,
          'is_favorite', item.is_favorite,
          'sales_count_30d', item.sales_count_30d
        )
        order by
          item.is_favorite desc,
          item.sales_count_30d desc,
          item.name
      )
      from available_flavors item
      where item.remaining > 0
    ), '[]'::jsonb),
    'payment_methods', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'code', method.code,
          'label', method.label,
          'active', method.active
        )
        order by method.sort_order, method.label
      )
      from public.payment_methods method
      where method.active
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.staff_get_quick_sale_catalog(date)
  from public, anon;
grant execute on function public.staff_get_quick_sale_catalog(date)
  to authenticated;

commit;
