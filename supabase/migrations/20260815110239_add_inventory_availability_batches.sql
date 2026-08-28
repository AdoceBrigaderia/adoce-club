begin;

-- Um sabor pode ter várias quantidades prontas em horários diferentes no
-- mesmo dia. O estoque agregado continua existindo para preservar Pede Junto,
-- recompensas e rotinas operacionais antigas; os lotes acrescentam a dimensão
-- de horário sem duplicar o estoque físico.
create table public.flavor_availability_batches (
  id uuid primary key default gen_random_uuid(),
  flavor_id uuid not null,
  service_date date not null,
  available_from time not null,
  quantity_available integer not null check (quantity_available >= 0),
  quantity_reserved integer not null default 0 check (
    quantity_reserved >= 0 and quantity_reserved <= quantity_available
  ),
  active boolean not null default true,
  created_by uuid references public.staff_members(user_id) on delete set null,
  updated_by uuid references public.staff_members(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flavor_availability_batches_inventory_fk
    foreign key (flavor_id, service_date)
    references public.flavor_availability(flavor_id, service_date)
    on update cascade on delete cascade,
  unique (flavor_id, service_date, available_from)
);

create index flavor_availability_batches_public_idx
  on public.flavor_availability_batches(service_date, flavor_id, available_from)
  where active;

alter table public.flavor_availability_batches enable row level security;
create policy flavor_availability_batches_staff_read
  on public.flavor_availability_batches
  for select to authenticated
  using (private.is_staff());

revoke all on public.flavor_availability_batches
  from public, anon, authenticated;
grant select on public.flavor_availability_batches to authenticated;

alter table public.instant_orders
  add column if not exists pickup_requested_time time,
  add column if not exists pickup_method text;

alter table public.instant_orders
  drop constraint if exists instant_orders_pickup_method_check,
  add constraint instant_orders_pickup_method_check
    check (pickup_method is null or pickup_method in ('customer', 'driver'));

-- Uma migraÃ§Ã£o financeira mais antiga foi reaplicada fora de ordem em alguns
-- ambientes. Restauramos a funÃ§Ã£o e o gatilho completos: sem a regra de
-- INSERT, pedidos novos tentam nascer com gross_amount/net_amount nulos.
create or replace function private.apply_instant_order_global_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_minutes integer;
begin
  if tg_op = 'INSERT' then
    new.gross_amount := coalesce(new.gross_amount, new.total, 0);
    new.payment_fee_amount := coalesce(new.payment_fee_amount, 0);
    new.net_amount := coalesce(
      new.net_amount,
      greatest(0, new.gross_amount - new.payment_fee_amount)
    );
  end if;

  if new.status in ('reserved', 'awaiting_payment')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    configured_minutes := private.current_instant_order_reservation_minutes();
    new.reserved_until := now() + make_interval(mins => configured_minutes);
    if new.status = 'awaiting_payment' then
      new.payment_expires_at := new.reserved_until;
    end if;
  end if;

  if new.payment_status = 'approved'
     and (tg_op = 'INSERT' or old.payment_status is distinct from 'approved') then
    new.payment_recorded_at := coalesce(new.payment_recorded_at, now());
    new.gross_amount := new.total;
    new.payment_fee_amount := least(
      new.total,
      round(
        (new.total * coalesce(new.payment_fee_percent, 0) / 100)
        + coalesce(new.payment_fee_fixed, 0),
        2
      )
    );
    new.net_amount := greatest(0, new.total - new.payment_fee_amount);
  end if;

  return new;
end;
$$;
revoke all on function private.apply_instant_order_global_rules()
  from public, anon, authenticated;

drop trigger if exists instant_orders_global_rules on public.instant_orders;
create trigger instant_orders_global_rules
before insert or update of status, payment_status on public.instant_orders
for each row execute function private.apply_instant_order_global_rules();

create table private.instant_order_batch_allocations (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.instant_order_items(id) on delete cascade,
  batch_id uuid not null references public.flavor_availability_batches(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'reserved' check (status in ('reserved', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_item_id, batch_id)
);

create index instant_order_batch_allocations_batch_idx
  on private.instant_order_batch_allocations(batch_id, status);
revoke all on private.instant_order_batch_allocations
  from public, anon, authenticated;
grant all on private.instant_order_batch_allocations to service_role;

-- Converte a escolha antiga agora/20h em um primeiro lote, sem marcar como
-- reserva de lote compromissos antigos que ainda não possuem rastreamento.
insert into public.flavor_availability_batches(
  flavor_id,
  service_date,
  available_from,
  quantity_available,
  quantity_reserved,
  active
)
select
  availability.flavor_id,
  availability.service_date,
  case
    when availability.pickup_release = 'evening' then time '20:00'
    else time '00:00'
  end,
  availability.quantity_available,
  0,
  true
from public.flavor_availability availability
where availability.quantity_available is not null
  and availability.quantity_available > 0
on conflict (flavor_id, service_date, available_from) do nothing;

-- Entradas feitas por rotinas antigas (produção planejada ou continuidade do
-- estoque) viram um lote disponível no momento da liberação. A sincronização
-- só cobre aumentos; baixas e reservas continuam nas rotinas transacionais.
create or replace function private.capture_unbatched_inventory_increase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  batches_total integer;
  missing_quantity integer;
  release_time time;
begin
  if new.quantity_available is null or new.quantity_available <= 0 then return new; end if;
  select coalesce(sum(batch.quantity_available), 0)::integer
  into batches_total
  from public.flavor_availability_batches batch
  where batch.flavor_id = new.flavor_id
    and batch.service_date = new.service_date
    and batch.active;
  missing_quantity := new.quantity_available - batches_total;
  if missing_quantity <= 0 then return new; end if;
  release_time := case
    when new.service_date = (now() at time zone 'America/Fortaleza')::date
      then date_trunc('minute', now() at time zone 'America/Fortaleza')::time
    else time '00:00'
  end;
  insert into public.flavor_availability_batches(
    flavor_id, service_date, available_from, quantity_available,
    quantity_reserved, active, updated_by
  ) values (
    new.flavor_id, new.service_date, release_time, missing_quantity,
    0, true, new.updated_by
  )
  on conflict (flavor_id, service_date, available_from) do update
    set quantity_available = public.flavor_availability_batches.quantity_available
          + excluded.quantity_available,
        active = true,
        updated_by = excluded.updated_by,
        updated_at = now();
  return new;
end;
$$;
revoke all on function private.capture_unbatched_inventory_increase()
  from public, anon, authenticated;
drop trigger if exists flavor_availability_capture_batch_increase
  on public.flavor_availability;
create trigger flavor_availability_capture_batch_increase
after insert or update of quantity_available on public.flavor_availability
for each row execute function private.capture_unbatched_inventory_increase();

create or replace function private.flavor_batch_quantity_by_time(
  target_flavor_id uuid,
  target_service_date date,
  target_pickup_time time
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  aggregate_free integer;
  batch_free integer;
  adjustment integer;
  eligible integer;
  batch_count integer;
begin
  select
    case
      when availability.quantity_available is null then 30
      else greatest(availability.quantity_available - availability.quantity_reserved, 0)
    end
  into aggregate_free
  from public.flavor_availability availability
  where availability.flavor_id = target_flavor_id
    and availability.service_date = target_service_date
    and availability.status in ('available', 'last_units', 'preorder_only');

  if aggregate_free is null then return 0; end if;

  select
    count(*)::integer,
    coalesce(sum(greatest(batch.quantity_available - batch.quantity_reserved, 0)), 0)::integer
  into batch_count, batch_free
  from public.flavor_availability_batches batch
  where batch.flavor_id = target_flavor_id
    and batch.service_date = target_service_date
    and batch.active;

  if batch_count = 0 then return aggregate_free; end if;
  adjustment := greatest(batch_free - aggregate_free, 0);

  with base as (
    select
      batch.available_from,
      greatest(batch.quantity_available - batch.quantity_reserved, 0)::integer as free,
      coalesce(sum(greatest(batch.quantity_available - batch.quantity_reserved, 0)) over (
        order by batch.available_from
        rows between unbounded preceding and 1 preceding
      ), 0)::integer as free_before
    from public.flavor_availability_batches batch
    where batch.flavor_id = target_flavor_id
      and batch.service_date = target_service_date
      and batch.active
  )
  select coalesce(sum(
    greatest(base.free - least(base.free, greatest(adjustment - base.free_before, 0)), 0)
  ) filter (where base.available_from <= target_pickup_time), 0)::integer
  into eligible
  from base;

  return least(eligible, aggregate_free);
end;
$$;
revoke all on function private.flavor_batch_quantity_by_time(uuid,date,time)
  from public, anon, authenticated;

create or replace function public.get_public_flavor_availability_batches(
  target_service_date date default current_date
)
returns table (
  id uuid,
  flavor_id uuid,
  available_from time,
  quantity_free integer
)
language sql
security definer
set search_path = ''
stable
as $$
  with aggregate_stock as (
    select
      availability.flavor_id,
      greatest(
        coalesce(availability.quantity_available, 30)
          - coalesce(availability.quantity_reserved, 0),
        0
      )::integer as aggregate_free
    from public.flavor_availability availability
    where availability.service_date = target_service_date
      and availability.status in ('available', 'last_units', 'preorder_only')
  ), base as (
    select
      batch.id,
      batch.flavor_id,
      batch.available_from,
      greatest(batch.quantity_available - batch.quantity_reserved, 0)::integer as free,
      aggregate_stock.aggregate_free,
      sum(greatest(batch.quantity_available - batch.quantity_reserved, 0)) over (
        partition by batch.flavor_id
      )::integer as batch_free,
      coalesce(sum(greatest(batch.quantity_available - batch.quantity_reserved, 0)) over (
        partition by batch.flavor_id
        order by batch.available_from
        rows between unbounded preceding and 1 preceding
      ), 0)::integer as free_before
    from public.flavor_availability_batches batch
    join aggregate_stock on aggregate_stock.flavor_id = batch.flavor_id
    where batch.service_date = target_service_date
      and batch.active
  )
  select
    base.id,
    base.flavor_id,
    base.available_from,
    greatest(
      base.free - least(
        base.free,
        greatest(base.batch_free - base.aggregate_free - base.free_before, 0)
      ),
      0
    )::integer as quantity_free
  from base
  order by base.flavor_id, base.available_from;
$$;
revoke all on function public.get_public_flavor_availability_batches(date) from public;
grant execute on function public.get_public_flavor_availability_batches(date)
  to anon, authenticated;

create or replace function public.staff_upsert_flavor_availability_batch(
  target_batch_id uuid,
  target_flavor_id uuid,
  target_service_date date,
  target_available_from time,
  target_quantity_available integer
)
returns public.flavor_availability_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  availability public.flavor_availability%rowtype;
  saved public.flavor_availability_batches%rowtype;
  batch_total integer;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  if target_available_from is null then raise exception 'Informe o horário do lote'; end if;
  if target_quantity_available is null or target_quantity_available < 1
     or target_quantity_available > 9999 then
    raise exception 'Informe uma quantidade entre 1 e 9.999 fatias';
  end if;

  insert into public.flavor_availability(
    flavor_id, service_date, status, quantity_available, quantity_reserved,
    pickup_release, updated_by, updated_at
  ) values (
    target_flavor_id, target_service_date, 'available', 0, 0,
    'now', (select auth.uid()), now()
  ) on conflict (flavor_id, service_date) do nothing;

  select * into availability
  from public.flavor_availability
  where flavor_id = target_flavor_id and service_date = target_service_date
  for update;

  if target_batch_id is null then
    insert into public.flavor_availability_batches(
      flavor_id, service_date, available_from, quantity_available,
      created_by, updated_by
    ) values (
      target_flavor_id, target_service_date, target_available_from,
      target_quantity_available, (select auth.uid()), (select auth.uid())
    )
    on conflict (flavor_id, service_date, available_from) do update
      set quantity_available = excluded.quantity_available,
          active = true,
          updated_by = (select auth.uid()),
          updated_at = now()
      where public.flavor_availability_batches.quantity_reserved
        <= excluded.quantity_available
    returning * into saved;
  else
    update public.flavor_availability_batches batch
    set available_from = target_available_from,
        quantity_available = target_quantity_available,
        active = true,
        updated_by = (select auth.uid()),
        updated_at = now()
    where batch.id = target_batch_id
      and batch.flavor_id = target_flavor_id
      and batch.service_date = target_service_date
      and batch.quantity_reserved <= target_quantity_available
    returning * into saved;
  end if;

  if saved.id is null then
    raise exception 'A quantidade não pode ficar abaixo das fatias já reservadas';
  end if;

  select coalesce(sum(batch.quantity_available), 0)::integer
  into batch_total
  from public.flavor_availability_batches batch
  where batch.flavor_id = target_flavor_id
    and batch.service_date = target_service_date
    and batch.active;

  if batch_total < availability.quantity_reserved then
    raise exception 'O total dos lotes não pode ficar abaixo das fatias já reservadas';
  end if;

  update public.flavor_availability
  set quantity_available = batch_total,
      status = case
        when batch_total - quantity_reserved <= 0 then 'sold_out'::public.availability_status
        when batch_total - quantity_reserved <= 3 then 'last_units'::public.availability_status
        else 'available'::public.availability_status
      end,
      pickup_release = 'now',
      updated_by = (select auth.uid()),
      updated_at = now()
  where flavor_id = target_flavor_id and service_date = target_service_date;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()), 'flavor_availability.batch_saved',
    'flavor_availability_batch', saved.id::text,
    jsonb_build_object(
      'flavor_id', target_flavor_id,
      'service_date', target_service_date,
      'available_from', target_available_from,
      'quantity_available', target_quantity_available
    )
  );
  return saved;
end;
$$;
revoke all on function public.staff_upsert_flavor_availability_batch(uuid,uuid,date,time,integer)
  from public, anon;
grant execute on function public.staff_upsert_flavor_availability_batch(uuid,uuid,date,time,integer)
  to authenticated;

create or replace function public.staff_delete_flavor_availability_batch(
  target_batch_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.flavor_availability_batches%rowtype;
  availability public.flavor_availability%rowtype;
  batch_total integer;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  select * into target from public.flavor_availability_batches
  where id = target_batch_id for update;
  if not found then raise exception 'Lote não encontrado'; end if;
  if target.quantity_reserved > 0 then
    raise exception 'Este lote possui fatias reservadas e não pode ser excluído';
  end if;
  select * into availability from public.flavor_availability
  where flavor_id = target.flavor_id and service_date = target.service_date for update;
  delete from public.flavor_availability_batches where id = target.id;
  select coalesce(sum(quantity_available), 0)::integer into batch_total
  from public.flavor_availability_batches
  where flavor_id = target.flavor_id and service_date = target.service_date and active;
  if batch_total < availability.quantity_reserved then
    raise exception 'O total restante não cobre as fatias já reservadas';
  end if;
  update public.flavor_availability
  set quantity_available = batch_total,
      status = case
        when batch_total - quantity_reserved <= 0 then 'sold_out'::public.availability_status
        when batch_total - quantity_reserved <= 3 then 'last_units'::public.availability_status
        else 'available'::public.availability_status
      end,
      updated_by = (select auth.uid()), updated_at = now()
  where id = availability.id;
  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()), 'flavor_availability.batch_deleted',
    'flavor_availability_batch', target.id::text,
    jsonb_build_object('flavor_id', target.flavor_id, 'service_date', target.service_date)
  );
end;
$$;
revoke all on function public.staff_delete_flavor_availability_batch(uuid)
  from public, anon;
grant execute on function public.staff_delete_flavor_availability_batch(uuid)
  to authenticated;

create or replace function private.allocate_instant_order_item_batches(
  target_order_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_item public.instant_order_items%rowtype;
  target_order public.instant_orders%rowtype;
  availability public.flavor_availability%rowtype;
  candidate record;
  remaining integer;
  take_quantity integer;
  batch_free integer;
  aggregate_free integer;
  pending_structured integer;
  adjustment integer;
  batch_count integer;
begin
  select * into target_item from public.instant_order_items
  where id = target_order_item_id for update;
  if not found or target_item.status <> 'reserved' then return; end if;
  if exists (
    select 1 from private.instant_order_batch_allocations allocation
    where allocation.order_item_id = target_item.id and allocation.status = 'reserved'
  ) then return; end if;

  select * into target_order from public.instant_orders
  where id = target_item.order_id for update;
  if target_order.pickup_requested_time is null then return; end if;

  select * into availability from public.flavor_availability
  where flavor_id = target_item.flavor_id
    and service_date = (now() at time zone 'America/Fortaleza')::date
  for update;
  if not found then raise exception 'O estoque deste sabor não está disponível hoje'; end if;

  perform 1 from public.flavor_availability_batches batch
  where batch.flavor_id = target_item.flavor_id
    and batch.service_date = availability.service_date
    and batch.active
  for update;

  select
    count(*)::integer,
    coalesce(sum(greatest(batch.quantity_available - batch.quantity_reserved, 0)), 0)::integer
  into batch_count, batch_free
  from public.flavor_availability_batches batch
  where batch.flavor_id = target_item.flavor_id
    and batch.service_date = availability.service_date
    and batch.active;
  if batch_count = 0 then return; end if;

  aggregate_free := greatest(
    coalesce(availability.quantity_available, 30) - availability.quantity_reserved,
    0
  );
  select coalesce(sum(item.quantity), 0)::integer
  into pending_structured
  from public.instant_order_items item
  join public.instant_orders order_row on order_row.id = item.order_id
  where item.flavor_id = target_item.flavor_id
    and item.status = 'reserved'
    and order_row.pickup_requested_time is not null
    and not exists (
      select 1 from private.instant_order_batch_allocations allocation
      where allocation.order_item_id = item.id and allocation.status = 'reserved'
    );
  adjustment := greatest(batch_free - aggregate_free - pending_structured, 0);
  remaining := target_item.quantity;

  for candidate in
    with base as (
      select
        batch.*,
        greatest(batch.quantity_available - batch.quantity_reserved, 0)::integer as free,
        coalesce(sum(greatest(batch.quantity_available - batch.quantity_reserved, 0)) over (
          order by batch.available_from
          rows between unbounded preceding and 1 preceding
        ), 0)::integer as free_before
      from public.flavor_availability_batches batch
      where batch.flavor_id = target_item.flavor_id
        and batch.service_date = availability.service_date
        and batch.active
    )
    select base.*,
      greatest(base.free - least(base.free, greatest(adjustment - base.free_before, 0)), 0)::integer
        as effective_free
    from base
    where base.available_from <= target_order.pickup_requested_time
    order by base.available_from desc
  loop
    exit when remaining <= 0;
    take_quantity := least(candidate.effective_free, remaining);
    if take_quantity <= 0 then continue; end if;
    update public.flavor_availability_batches
    set quantity_reserved = quantity_reserved + take_quantity,
        updated_at = now()
    where id = candidate.id;
    insert into private.instant_order_batch_allocations(
      order_item_id, batch_id, quantity, status
    ) values (target_item.id, candidate.id, take_quantity, 'reserved');
    remaining := remaining - take_quantity;
  end loop;

  if remaining > 0 then
    raise exception 'Não há fatias suficientes deste sabor para o horário escolhido';
  end if;
end;
$$;
revoke all on function private.allocate_instant_order_item_batches(uuid)
  from public, anon, authenticated;

create or replace function private.finish_instant_order_item_batches(
  target_order_item_id uuid,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  allocation record;
begin
  if next_status not in ('paid', 'cancelled') then return; end if;
  for allocation in
    select stored.* from private.instant_order_batch_allocations stored
    where stored.order_item_id = target_order_item_id
      and stored.status = 'reserved'
    for update
  loop
    if next_status = 'paid' then
      update public.flavor_availability_batches
      set quantity_available = greatest(0, quantity_available - allocation.quantity),
          quantity_reserved = greatest(0, quantity_reserved - allocation.quantity),
          updated_at = now()
      where id = allocation.batch_id;
    else
      update public.flavor_availability_batches
      set quantity_reserved = greatest(0, quantity_reserved - allocation.quantity),
          updated_at = now()
      where id = allocation.batch_id;
    end if;
    update private.instant_order_batch_allocations
    set status = next_status, updated_at = now()
    where id = allocation.id;
  end loop;
end;
$$;
revoke all on function private.finish_instant_order_item_batches(uuid,text)
  from public, anon, authenticated;

create or replace function private.sync_instant_order_item_batches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'reserved' then
      perform private.finish_instant_order_item_batches(old.id, 'cancelled');
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' and new.status = 'reserved' then
    perform private.allocate_instant_order_item_batches(new.id);
  elsif tg_op = 'UPDATE' and old.status <> 'reserved' and new.status = 'reserved' then
    perform private.allocate_instant_order_item_batches(new.id);
  elsif tg_op = 'UPDATE' and old.status = 'reserved' and new.status = 'paid' then
    perform private.finish_instant_order_item_batches(new.id, 'paid');
  elsif tg_op = 'UPDATE' and old.status = 'reserved'
        and new.status in ('cancelled', 'unavailable') then
    perform private.finish_instant_order_item_batches(new.id, 'cancelled');
  end if;
  return new;
end;
$$;
revoke all on function private.sync_instant_order_item_batches()
  from public, anon, authenticated;

drop trigger if exists instant_order_items_sync_batches on public.instant_order_items;
create trigger instant_order_items_sync_batches
after insert or update of status on public.instant_order_items
for each row execute function private.sync_instant_order_item_batches();
drop trigger if exists instant_order_items_release_batches_on_delete on public.instant_order_items;
create trigger instant_order_items_release_batches_on_delete
before delete on public.instant_order_items
for each row execute function private.sync_instant_order_item_batches();

create or replace function public.submit_instant_order_v7(
  requested_operation_key uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_notes text default '',
  requested_payment_method text default 'pix',
  requested_reward jsonb default null,
  requested_pickup_time time default null,
  requested_pickup_method text default 'customer'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_request jsonb;
  calculated_request_hash text;
  previous_request private.public_instant_order_requests%rowtype;
  response jsonb;
  created_order public.instant_orders%rowtype;
  requested_item jsonb;
  requested_quantity integer;
  phone_rate_limit jsonb;
  account_rate_limit jsonb;
  caller_id uuid := auth.uid();
  local_date date := (now() at time zone 'America/Fortaleza')::date;
  local_time time := (now() at time zone 'America/Fortaleza')::time;
  pickup_allowed boolean := false;
  pickup_exception public.business_hour_exceptions%rowtype;
begin
  if requested_operation_key is null then raise exception 'Chave da operação inválida'; end if;

  normalized_request := jsonb_build_object(
    'customer_name', btrim(coalesce(requested_customer_name, '')),
    'customer_phone', regexp_replace(coalesce(requested_customer_phone, ''), '\D', '', 'g'),
    'items', coalesce(requested_items, 'null'::jsonb),
    'notes', btrim(coalesce(requested_notes, '')),
    'payment_method', btrim(coalesce(requested_payment_method, '')),
    'reward', coalesce(requested_reward, 'null'::jsonb),
    'pickup_time', requested_pickup_time,
    'pickup_method', requested_pickup_method
  );
  calculated_request_hash := encode(
    extensions.digest(normalized_request::text, 'sha256'), 'hex'
  );
  perform pg_advisory_xact_lock(hashtextextended(
    'public-instant-order:' || requested_operation_key::text, 0
  ));
  delete from private.public_instant_order_requests stored
  where stored.operation_key = requested_operation_key and stored.expires_at <= now();
  select * into previous_request from private.public_instant_order_requests stored
  where stored.operation_key = requested_operation_key;
  if found then
    if previous_request.request_hash <> calculated_request_hash then
      raise exception 'A chave da operação já foi usada com outro pedido';
    end if;
    return previous_request.response_payload || jsonb_build_object('idempotent', true);
  end if;

  if requested_pickup_time is null then raise exception 'Escolha o horário da retirada'; end if;
  if requested_pickup_method not in ('customer', 'driver') then
    raise exception 'Escolha quem fará a retirada';
  end if;
  if requested_pickup_time < local_time then
    raise exception 'Escolha um horário de retirada que ainda não passou';
  end if;

  select * into pickup_exception
  from public.business_hour_exceptions exception
  where exception.channel_slug = 'in_person'
    and exception.service_date = local_date;
  if found then
    pickup_allowed := not pickup_exception.closed
      and requested_pickup_time between pickup_exception.opens_at and pickup_exception.closes_at;
  else
    select exists (
      select 1 from public.business_hours hour
      where hour.channel_slug = 'in_person'
        and hour.weekday = extract(dow from local_date)::integer
        and hour.active
        and requested_pickup_time between hour.opens_at and hour.closes_at
    ) into pickup_allowed;
  end if;
  if not pickup_allowed then
    raise exception 'Escolha um horário dentro do atendimento do Cantinho da Adoce';
  end if;

  if requested_items is null or jsonb_typeof(requested_items) <> 'array' then
    raise exception 'Escolha pelo menos uma fatia';
  end if;
  for requested_item in select value from jsonb_array_elements(requested_items)
  loop
    requested_quantity := (requested_item->>'quantity')::integer;
    if private.flavor_batch_quantity_by_time(
      (requested_item->>'flavor_id')::uuid,
      local_date,
      requested_pickup_time
    ) < requested_quantity then
      raise exception 'A quantidade escolhida não fica pronta até o horário informado';
    end if;
  end loop;
  if requested_reward is not null and requested_reward <> 'null'::jsonb
     and private.flavor_batch_quantity_by_time(
       (requested_reward->>'flavor_id')::uuid,
       local_date,
       requested_pickup_time
     ) < 1 then
    raise exception 'A fatia-presente escolhida não fica pronta até o horário informado';
  end if;

  phone_rate_limit := public.consume_public_endpoint_rate_limit_bff(
    'instant-order:db-phone',
    encode(extensions.digest(
      'phone:' || (normalized_request->>'customer_phone'), 'sha256'
    ), 'hex'),
    3600, 8
  );
  if not coalesce((phone_rate_limit->>'allowed')::boolean, false) then
    raise exception 'Muitas tentativas. Aguarde antes de enviar outro pedido.';
  end if;
  if caller_id is not null then
    account_rate_limit := public.consume_public_endpoint_rate_limit_bff(
      'instant-order:db-account',
      encode(extensions.digest('account:' || caller_id::text, 'sha256'), 'hex'),
      3600, 12
    );
    if not coalesce((account_rate_limit->>'allowed')::boolean, false) then
      raise exception 'Muitas tentativas. Aguarde antes de enviar outro pedido.';
    end if;
  end if;

  response := public.submit_instant_order_v5(
    requested_customer_name,
    requested_customer_phone,
    requested_items,
    requested_notes,
    requested_payment_method,
    requested_reward
  );
  if coalesce((response->>'accepted')::boolean, false) then
    select * into created_order from public.instant_orders
    where order_number = response->>'order_number' for update;
    update public.instant_orders
    set pickup_requested_time = requested_pickup_time,
        pickup_method = requested_pickup_method,
        updated_at = now()
    where id = created_order.id;
    for requested_item in
      select to_jsonb(item) from public.instant_order_items item
      where item.order_id = created_order.id and item.status = 'reserved'
    loop
      perform private.allocate_instant_order_item_batches((requested_item->>'id')::uuid);
    end loop;
    response := response || jsonb_build_object(
      'pickup_requested_time', to_char(requested_pickup_time, 'HH24:MI'),
      'pickup_method', requested_pickup_method
    );
  end if;

  insert into private.public_instant_order_requests(
    operation_key, request_hash, response_payload
  ) values (requested_operation_key, calculated_request_hash, response);
  return response || jsonb_build_object('idempotent', false);
end;
$$;

create or replace function public.staff_submit_instant_order_v5(
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
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  return public.submit_instant_order_v5(
    requested_customer_name,
    requested_customer_phone,
    requested_items,
    requested_notes,
    requested_payment_method,
    requested_reward
  );
end;
$$;

revoke all on function public.submit_instant_order_v5(text,text,jsonb,text,text,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.submit_instant_order_v7(uuid,text,text,jsonb,text,text,jsonb,time,text)
  from public;
grant execute on function public.submit_instant_order_v7(uuid,text,text,jsonb,text,text,jsonb,time,text)
  to anon, authenticated;
grant execute on function public.get_checkout_payment_methods()
  to anon, authenticated;
revoke all on function public.staff_submit_instant_order_v5(text,text,jsonb,text,text,jsonb)
  from public, anon;
grant execute on function public.staff_submit_instant_order_v5(text,text,jsonb,text,text,jsonb)
  to authenticated;

comment on table public.flavor_availability_batches is
  'Lotes do estoque diário com quantidade e primeiro horário de retirada.';
comment on column public.instant_orders.pickup_requested_time is
  'Horário de retirada validado no banco para o pedido completo.';
comment on function public.submit_instant_order_v7(uuid,text,text,jsonb,text,text,jsonb,time,text) is
  'Submete pedido idempotente, valida horário e preserva a reserva por lote.';

commit;
