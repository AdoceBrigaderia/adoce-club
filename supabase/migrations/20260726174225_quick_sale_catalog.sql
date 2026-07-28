begin;

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
  result jsonb;
begin
  if (select auth.uid()) is null
     or not private.staff_has_any_capability('sell') then
    raise exception 'Voce nao possui permissao para vender';
  end if;

  with available_flavors as (
    select
      flavor.id,
      flavor.name,
      flavor.base_price,
      flavor.image_path,
      greatest(
        0,
        coalesce(availability.quantity_available, 0)
          - coalesce(availability.quantity_reserved, 0)
      )::integer as remaining
    from public.flavors flavor
    left join public.flavor_availability availability
      on availability.flavor_id = flavor.id
     and availability.service_date = target_date
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
          'remaining', item.remaining
        )
        order by item.name
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

revoke all on function public.staff_get_quick_sale_catalog(date) from public, anon;
grant execute on function public.staff_get_quick_sale_catalog(date) to authenticated;

commit;
