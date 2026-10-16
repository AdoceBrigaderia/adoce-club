-- Rascunhos abandonados não podem manter estoque preso. A função é global,
-- idempotente e recalcula o agregado usando as fontes de reserva vigentes.
create or replace function private.expire_cash_draft_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft record;
  released integer := 0;
begin
  for draft in
    select * from public.cash_draft_reservations
    where expires_at <= now()
    order by service_date, flavor_id, id
    for update skip locked
  loop
    perform 1 from public.flavor_availability
      where flavor_id = draft.flavor_id and service_date = draft.service_date
      for update;
    delete from public.cash_draft_reservations where id = draft.id;
    perform private.recalcular_reserva_de_fatias(draft.flavor_id, draft.service_date);
    released := released + draft.quantity;
  end loop;

  if released > 0 then
    insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
    values (null, 'cash_draft.expired', 'cash_draft_reservation', gen_random_uuid()::text,
      jsonb_build_object('released_slices', released));
  end if;
  return released;
end;
$$;

revoke all on function private.expire_cash_draft_reservations() from public, anon, authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job
  where jobname = 'adoce-expire-cash-draft-reservations';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'adoce-expire-cash-draft-reservations',
    '* * * * *',
    'select private.expire_cash_draft_reservations();'
  );
end;
$$;

-- Rastreia a continuidade comercial sem trocar a identidade do lote físico.
create table if not exists private.flavor_batch_continuity (
  id uuid primary key default gen_random_uuid(),
  source_batch_id uuid not null references public.flavor_availability_batches(id) on delete restrict,
  target_batch_id uuid not null references public.flavor_availability_batches(id) on delete restrict,
  target_service_date date not null,
  carried_quantity integer not null check (carried_quantity >= 0),
  created_at timestamptz not null default now(),
  unique (source_batch_id, target_service_date)
);

create or replace function private.carry_forward_flavor_inventory_batches(
  target_date date default ((now() at time zone 'America/Fortaleza')::date)
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  source record;
  target_id uuid;
  copied integer := 0;
begin
  perform private.carry_forward_flavor_inventory(target_date);

  for source in
    select distinct on (b.flavor_id)
      b.*
    from public.flavor_availability_batches b
    join public.flavor_availability a
      on a.flavor_id = b.flavor_id and a.service_date = b.service_date
    where b.service_date < target_date
      and b.active
      and b.quantity_available > 0
      and a.status not in ('sold_out', 'unavailable')
      and not exists (
        select 1 from private.flavor_batch_continuity c
        where c.source_batch_id = b.id and c.target_service_date = target_date
      )
    order by b.flavor_id, b.service_date desc, b.available_from desc
  loop
    insert into public.flavor_availability_batches(
      flavor_id, service_date, available_from, quantity_available,
      quantity_reserved, active, created_by, updated_by
    ) values (
      source.flavor_id, target_date, time '08:00', source.quantity_available,
      least(source.quantity_reserved, source.quantity_available), true, null, null
    )
    on conflict (flavor_id, service_date, available_from) do update
      set quantity_available = greatest(public.flavor_availability_batches.quantity_available, excluded.quantity_available),
          quantity_reserved = greatest(public.flavor_availability_batches.quantity_reserved, excluded.quantity_reserved),
          updated_at = now()
    returning id into target_id;

    insert into private.flavor_batch_continuity(
      source_batch_id, target_batch_id, target_service_date, carried_quantity
    ) values (source.id, target_id, target_date, source.quantity_available)
    on conflict (source_batch_id, target_service_date) do nothing;
    copied := copied + 1;
  end loop;

  if copied > 0 then
    insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
    values (null, 'inventory.batch_continued', 'flavor_inventory_batch', target_date::text,
      jsonb_build_object('service_date', target_date, 'copied_batches', copied,
        'available_from', '08:00', 'preserves_physical_origin', true));
  end if;
  return copied;
end;
$$;

revoke all on function private.carry_forward_flavor_inventory_batches(date)
  from public, anon, authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job
  where jobname = 'adoce-carry-forward-flavor-inventory';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'adoce-carry-forward-flavor-inventory',
    '0 11 * * *',
    'select private.carry_forward_flavor_inventory_batches((now() at time zone ''America/Fortaleza'')::date);'
  );
end;
$$;
