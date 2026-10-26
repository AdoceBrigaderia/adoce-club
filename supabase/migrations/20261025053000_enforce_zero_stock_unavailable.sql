begin;

-- Um saldo livre zerado nunca pode continuar sendo anunciado como disponível.
create or replace function private.normalize_flavor_availability_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  free_quantity integer := greatest(
    coalesce(new.quantity_available, 0) - coalesce(new.quantity_reserved, 0),
    0
  );
begin
  if new.status in ('available', 'last_units') then
    new.status := case
      when free_quantity = 0 then 'sold_out'::public.availability_status
      when free_quantity <= 3 then 'last_units'::public.availability_status
      else 'available'::public.availability_status
    end;
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_flavor_availability_status()
  from public, anon, authenticated;

drop trigger if exists normalize_flavor_availability_status
  on public.flavor_availability;
create trigger normalize_flavor_availability_status
before insert or update of status, quantity_available, quantity_reserved
on public.flavor_availability
for each row execute function private.normalize_flavor_availability_status();

update public.flavor_availability
set status = 'sold_out'::public.availability_status,
    updated_at = now()
where status in ('available', 'last_units')
  and greatest(coalesce(quantity_available, 0) - coalesce(quantity_reserved, 0), 0) = 0;

-- A continuidade diária só leva saldo realmente livre e recalcula o rótulo.
create or replace function private.carry_forward_flavor_inventory(
  target_date date default ((now() at time zone 'America/Fortaleza')::date)
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  copied_rows integer := 0;
  fortaleza_today date := (now() at time zone 'America/Fortaleza')::date;
begin
  if target_date is null or target_date < fortaleza_today - 1 or target_date > fortaleza_today + 1 then
    raise exception 'Data invalida para continuidade do estoque';
  end if;

  insert into public.flavor_availability(
    flavor_id, service_date, status, note, quantity_available,
    quantity_reserved, updated_by, updated_at
  )
  select
    previous.flavor_id,
    target_date,
    case
      when previous.quantity_available - previous.quantity_reserved <= 3
        then 'last_units'::public.availability_status
      else 'available'::public.availability_status
    end,
    previous.note,
    previous.quantity_available - previous.quantity_reserved,
    0,
    null,
    now()
  from public.flavor_availability previous
  where previous.service_date = target_date - 1
    and previous.status not in ('sold_out', 'unavailable')
    and greatest(
      coalesce(previous.quantity_available, 0) - coalesce(previous.quantity_reserved, 0),
      0
    ) > 0
    and not exists (
      select 1
      from public.flavor_availability current_inventory
      where current_inventory.flavor_id = previous.flavor_id
        and current_inventory.service_date = target_date
    )
  on conflict (flavor_id, service_date) do nothing;

  get diagnostics copied_rows = row_count;
  if copied_rows > 0 then
    insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
    values (
      null,
      'inventory.day_continued',
      'flavor_inventory',
      target_date::text,
      jsonb_build_object(
        'service_date', target_date,
        'copied_rows', copied_rows,
        'rule', 'strict_positive_free_balance',
        'reserved', 'zerada'
      )
    );
  end if;
  return copied_rows;
end;
$$;

revoke all on function private.carry_forward_flavor_inventory(date)
  from public, anon, authenticated;

commit;
