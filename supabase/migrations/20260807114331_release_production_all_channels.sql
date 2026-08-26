-- Correcao do bug que manteve a loja "esgotada" de 28/07 a 07/08/2026.
--
-- A liberacao de producao filtrava channel_slug = 'online_orders'. Quando a
-- producao do dia era planejada no canal presencial (foi o caso de 31/07 e
-- 01/08, com 78 fatias), o botao da operacao nao enxergava nada e respondia
-- que tudo ja havia sido liberado. O estoque publico ficava zerado.
--
-- O estoque fisico do dia (flavor_availability) e unico e compartilhado entre
-- os canais. Portanto toda producao publicada para a data deve entrar nele,
-- independente do canal em que foi planejada.

drop index if exists public.weekly_service_menu_pending_release_idx;

create index if not exists weekly_service_menu_pending_release_idx
  on public.weekly_service_menu(service_date, channel_slug)
  where status = 'published'
    and quantity_planned is not null
    and quantity_planned > quantity_released;

create or replace function public.staff_release_weekly_production(
  release_date date,
  release_item_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  fortaleza_today date := (now() at time zone 'America/Fortaleza')::date;
  menu_item public.weekly_service_menu%rowtype;
  release_quantity integer;
  released_total integer := 0;
  released_items integer := 0;
  release_summary jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null or not private.is_manager() then
    raise exception 'Acesso nao autorizado';
  end if;

  if release_date is null or release_date <> fortaleza_today then
    raise exception 'A producao so pode ser liberada no proprio dia';
  end if;

  perform private.carry_forward_flavor_inventory(release_date);

  for menu_item in
    select menu.*
    from public.weekly_service_menu menu
    where menu.service_date = release_date
      and menu.status = 'published'
      and menu.quantity_planned is not null
      and menu.quantity_planned > menu.quantity_released
      and (
        release_item_ids is null
        or menu.id = any(release_item_ids)
      )
    order by menu.created_at
    for update
  loop
    release_quantity := menu_item.quantity_planned - menu_item.quantity_released;

    insert into public.flavor_availability (
      flavor_id,
      service_date,
      status,
      note,
      quantity_available,
      quantity_reserved,
      updated_by,
      updated_at
    )
    values (
      menu_item.flavor_id,
      release_date,
      case
        when release_quantity <= 0 then 'unavailable'::public.availability_status
        when release_quantity <= 3 then 'last_units'::public.availability_status
        else 'available'::public.availability_status
      end,
      menu_item.note,
      release_quantity,
      0,
      (select auth.uid()),
      now()
    )
    on conflict (flavor_id, service_date)
    do update set
      quantity_available = coalesce(public.flavor_availability.quantity_available, 0)
        + excluded.quantity_available,
      status = case
        when (
          coalesce(public.flavor_availability.quantity_available, 0)
          + excluded.quantity_available
          - public.flavor_availability.quantity_reserved
        ) <= 0 then 'unavailable'::public.availability_status
        when (
          coalesce(public.flavor_availability.quantity_available, 0)
          + excluded.quantity_available
          - public.flavor_availability.quantity_reserved
        ) <= 3 then 'last_units'::public.availability_status
        else 'available'::public.availability_status
      end,
      note = coalesce(excluded.note, public.flavor_availability.note),
      updated_by = (select auth.uid()),
      updated_at = now();

    update public.weekly_service_menu
    set quantity_released = quantity_released + release_quantity,
        released_at = now(),
        released_by = (select auth.uid()),
        updated_by = (select auth.uid()),
        updated_at = now()
    where id = menu_item.id;

    released_items := released_items + 1;
    released_total := released_total + release_quantity;
    release_summary := release_summary || jsonb_build_array(
      jsonb_build_object(
        'menu_item_id', menu_item.id,
        'flavor_id', menu_item.flavor_id,
        'channel_slug', menu_item.channel_slug,
        'quantity_released', release_quantity
      )
    );
  end loop;

  if released_items = 0 then
    return jsonb_build_object(
      'service_date', release_date,
      'released_items', 0,
      'released_total', 0,
      'items', '[]'::jsonb,
      'already_released', true
    );
  end if;

  insert into public.audit_events (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  )
  values (
    (select auth.uid()),
    'inventory.production_released',
    'weekly_service_menu',
    release_date::text,
    jsonb_build_object(
      'service_date', release_date,
      'released_items', released_items,
      'released_total', released_total,
      'items', release_summary,
      'rule', 'confirmed_production_all_channels_plus_existing_physical_balance'
    )
  );

  return jsonb_build_object(
    'service_date', release_date,
    'released_items', released_items,
    'released_total', released_total,
    'items', release_summary,
    'already_released', false
  );
end;
$$;

revoke all on function public.staff_release_weekly_production(date, uuid[])
  from public, anon, authenticated;
grant execute on function public.staff_release_weekly_production(date, uuid[])
  to authenticated;
