-- O cardápio semanal é planejamento. O estoque físico só muda quando um
-- proprietário confirma que a produção do dia realmente ficou pronta.
-- A liberação soma a produção confirmada às sobras já transportadas do dia
-- anterior e é idempotente: a mesma quantidade planejada não entra duas vezes.

alter table public.weekly_service_menu
  add column if not exists quantity_released integer not null default 0,
  add column if not exists released_at timestamptz,
  add column if not exists released_by uuid references public.staff_members(user_id);

alter table public.weekly_service_menu
  drop constraint if exists weekly_service_menu_quantity_released_check,
  add constraint weekly_service_menu_quantity_released_check
    check (
      quantity_released >= 0
      and (
        quantity_planned is null
        or quantity_released <= quantity_planned
      )
    );

create index if not exists weekly_service_menu_pending_release_idx
  on public.weekly_service_menu(service_date, channel_slug)
  where status = 'published'
    and channel_slug = 'online_orders'
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
    raise exception 'Acesso não autorizado';
  end if;

  if release_date is null or release_date <> fortaleza_today then
    raise exception 'A produção só pode ser liberada no próprio dia';
  end if;

  -- Garante que as sobras físicas estejam presentes antes de somar a produção.
  perform private.carry_forward_flavor_inventory(release_date);

  for menu_item in
    select menu.*
    from public.weekly_service_menu menu
    where menu.service_date = release_date
      and menu.channel_slug = 'online_orders'
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
      'rule', 'confirmed_production_plus_existing_physical_balance'
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
