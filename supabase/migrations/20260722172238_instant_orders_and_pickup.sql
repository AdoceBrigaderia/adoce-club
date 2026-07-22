-- Pedidos imediatos de fatias e locais de retirada.
-- O estoque permanece fechado para escrita direta; toda reserva passa por RPC
-- transacional com bloqueio das linhas de disponibilidade.

create sequence if not exists private.instant_order_number_seq;

create table if not exists private.instant_order_settings (
  singleton boolean primary key default true check (singleton),
  automatic_checkout_enabled boolean not null default false,
  automatic_checkout_minimum integer not null default 4 check (automatic_checkout_minimum between 1 and 30),
  reservation_minutes integer not null default 15 check (reservation_minutes between 5 and 60),
  updated_at timestamptz not null default now()
);
insert into private.instant_order_settings(singleton) values (true)
on conflict (singleton) do nothing;
revoke all on private.instant_order_settings from public, anon, authenticated;

create table if not exists public.pickup_locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 100),
  public_label text not null check (char_length(public_label) between 2 and 160),
  address_text text not null check (char_length(address_text) between 8 and 300),
  map_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.pickup_locations (
  slug, name, public_label, address_text, map_url, sort_order
) values (
  'portao-adoce',
  'Portão da Adoce',
  'Retirada no portão da Adoce',
  'Rua Professor Odílio Filho, 227, Passaré, Fortaleza - CE',
  'https://www.google.com/maps/search/?api=1&query=Rua%20Professor%20Od%C3%ADlio%20Filho%2C%20227%2C%20Passar%C3%A9%2C%20Fortaleza%20-%20CE',
  10
) on conflict (slug) do update set
  name = excluded.name,
  public_label = excluded.public_label,
  address_text = excluded.address_text,
  map_url = excluded.map_url,
  active = true,
  updated_at = now();

alter table public.business_hours
  add column if not exists pickup_location_id uuid references public.pickup_locations(id);
alter table public.business_hour_exceptions
  add column if not exists pickup_location_id uuid references public.pickup_locations(id);

update public.business_hours
set pickup_location_id = (select id from public.pickup_locations where slug = 'portao-adoce')
where channel_slug = 'online_orders' and pickup_location_id is null;
update public.business_hour_exceptions
set pickup_location_id = (select id from public.pickup_locations where slug = 'portao-adoce')
where channel_slug = 'online_orders' and pickup_location_id is null;

create table if not exists public.instant_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  public_token_hash text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_phone text not null check (char_length(customer_phone) between 12 and 16),
  status text not null default 'awaiting_confirmation' check (status in (
    'awaiting_confirmation', 'reserved', 'awaiting_payment', 'paid',
    'preparing', 'ready', 'completed', 'cancelled', 'expired'
  )),
  payment_status text not null default 'not_started' check (payment_status in (
    'not_started', 'pending', 'approved', 'rejected', 'cancelled', 'refunded', 'expired'
  )),
  checkout_mode text not null check (checkout_mode in ('staff_confirmation', 'automatic')),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  total numeric(10,2) not null check (total >= 0),
  payment_provider text,
  payment_reference text,
  payment_url text,
  payment_expires_at timestamptz,
  pickup_location_id uuid references public.pickup_locations(id),
  pickup_label text not null default '',
  pickup_address text not null default '',
  customer_notes text not null default '' check (char_length(customer_notes) <= 1000),
  internal_notes text not null default '' check (char_length(internal_notes) <= 2000),
  reserved_until timestamptz,
  paid_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  cancellation_reason text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instant_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.instant_orders(id) on delete cascade,
  flavor_id uuid not null references public.flavors(id),
  flavor_name text not null,
  unit_price numeric(10,2) not null check (unit_price > 0),
  quantity integer not null check (quantity between 1 and 30),
  status text not null default 'selected' check (status in (
    'selected', 'reserved', 'paid', 'cancelled', 'unavailable'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, flavor_id)
);

create index if not exists instant_orders_status_created_idx
  on public.instant_orders(status, created_at desc);
create index if not exists instant_orders_phone_created_idx
  on public.instant_orders(customer_phone, created_at desc);
create index if not exists instant_orders_reservation_idx
  on public.instant_orders(reserved_until)
  where status in ('reserved', 'awaiting_payment');
create index if not exists instant_order_items_order_idx
  on public.instant_order_items(order_id, status);

alter table public.pickup_locations enable row level security;
alter table public.instant_orders enable row level security;
alter table public.instant_order_items enable row level security;

revoke all on public.pickup_locations, public.instant_orders, public.instant_order_items
  from public, anon, authenticated;
grant select on public.pickup_locations to anon, authenticated;
grant insert, update, delete on public.pickup_locations to authenticated;
grant select, insert, update, delete on public.instant_orders, public.instant_order_items
  to authenticated;
grant all on public.pickup_locations, public.instant_orders, public.instant_order_items
  to service_role;

create policy pickup_locations_public_read
  on public.pickup_locations for select to anon, authenticated
  using (active);
create policy pickup_locations_manager_all
  on public.pickup_locations for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy instant_orders_staff_all
  on public.instant_orders for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));
create policy instant_order_items_staff_all
  on public.instant_order_items for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create or replace function private.instant_order_hash(raw_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(coalesce(raw_token, ''), 'sha256'), 'hex');
$$;
revoke all on function private.instant_order_hash(text) from public, anon, authenticated;

create or replace function private.assign_instant_order_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number := 'FAT-' || to_char((now() at time zone 'America/Fortaleza')::date, 'YYYYMMDD') || '-' ||
      lpad(nextval('private.instant_order_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists instant_order_number on public.instant_orders;
create trigger instant_order_number before insert on public.instant_orders
for each row execute function private.assign_instant_order_number();

create or replace function private.release_instant_order_stock(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.flavor_availability availability
  set quantity_reserved = greatest(0, availability.quantity_reserved - item.quantity),
      updated_at = now()
  from public.instant_order_items item
  where item.order_id = target_order_id
    and item.status = 'reserved'
    and availability.flavor_id = item.flavor_id
    and availability.service_date = (now() at time zone 'America/Fortaleza')::date
    and availability.quantity_available is not null;

  update public.instant_order_items
  set status = 'cancelled', updated_at = now()
  where order_id = target_order_id and status = 'reserved';
end;
$$;
revoke all on function private.release_instant_order_stock(uuid) from public, anon, authenticated;

create or replace function private.reserve_instant_order_stock(target_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  conflicts jsonb;
begin
  perform 1 from public.flavor_availability availability
  where availability.service_date = (now() at time zone 'America/Fortaleza')::date
    and availability.flavor_id in (
      select item.flavor_id from public.instant_order_items item
      where item.order_id = target_order_id and item.status = 'selected'
    )
  for update;

  select coalesce(jsonb_agg(jsonb_build_object(
    'flavor_id', requested.flavor_id,
    'flavor_name', requested.flavor_name,
    'requested', requested.quantity,
    'available', greatest(coalesce(availability.quantity_available - availability.quantity_reserved, 0), 0)
  )), '[]'::jsonb)
  into conflicts
  from (
    select item.flavor_id, max(item.flavor_name) flavor_name, sum(item.quantity)::integer quantity
    from public.instant_order_items item
    where item.order_id = target_order_id and item.status = 'selected'
    group by item.flavor_id
  ) requested
  left join public.flavor_availability availability
    on availability.flavor_id = requested.flavor_id
   and availability.service_date = (now() at time zone 'America/Fortaleza')::date
  where availability.status is null
     or availability.status in ('sold_out', 'unavailable')
     or availability.quantity_available is null
     or availability.quantity_available - availability.quantity_reserved < requested.quantity;

  if jsonb_array_length(conflicts) > 0 then return conflicts; end if;

  update public.flavor_availability availability
  set quantity_reserved = availability.quantity_reserved + requested.quantity,
      updated_at = now()
  from (
    select item.flavor_id, sum(item.quantity)::integer quantity
    from public.instant_order_items item
    where item.order_id = target_order_id and item.status = 'selected'
    group by item.flavor_id
  ) requested
  where availability.flavor_id = requested.flavor_id
    and availability.service_date = (now() at time zone 'America/Fortaleza')::date
    and availability.quantity_available is not null;

  update public.instant_order_items
  set status = 'reserved', updated_at = now()
  where order_id = target_order_id and status = 'selected';

  return '[]'::jsonb;
end;
$$;
revoke all on function private.reserve_instant_order_stock(uuid) from public, anon, authenticated;

create or replace function public.submit_instant_order(
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_phone text;
  raw_token text := encode(extensions.gen_random_bytes(24), 'hex');
  order_row public.instant_orders%rowtype;
  location_row public.pickup_locations%rowtype;
  total_quantity integer;
  total_value numeric(10,2);
  automatic_threshold integer;
  reservation_minutes integer;
  automatic_checkout_enabled boolean;
  conflicts jsonb;
begin
  if char_length(btrim(coalesce(requested_customer_name, ''))) < 2 then
    raise exception 'Informe seu nome para identificarmos o pedido';
  end if;
  normalized_phone := regexp_replace(coalesce(requested_customer_phone, ''), '\D', '', 'g');
  if length(normalized_phone) in (10, 11) then normalized_phone := '55' || normalized_phone; end if;
  if length(normalized_phone) not in (12, 13) then
    raise exception 'Informe um WhatsApp válido com DDD';
  end if;
  if requested_items is null or jsonb_typeof(requested_items) <> 'array'
     or jsonb_array_length(requested_items) = 0 then
    raise exception 'Escolha pelo menos uma fatia';
  end if;

  select settings.automatic_checkout_enabled, settings.automatic_checkout_minimum,
    settings.reservation_minutes
  into automatic_checkout_enabled, automatic_threshold, reservation_minutes
  from private.instant_order_settings settings where settings.singleton;

  with requested as (
    select (entry->>'flavor_id')::uuid flavor_id, sum((entry->>'quantity')::integer)::integer quantity
    from jsonb_array_elements(requested_items) entry
    group by (entry->>'flavor_id')::uuid
  ), priced as (
    select requested.flavor_id, requested.quantity, flavor.name,
      coalesce(flavor.base_price, 0)::numeric(10,2) unit_price
    from requested join public.flavors flavor on flavor.id = requested.flavor_id and flavor.active
    where requested.quantity between 1 and 30 and coalesce(flavor.base_price, 0) > 0
  )
  select coalesce(sum(quantity), 0)::integer,
    coalesce(sum(quantity * unit_price), 0)::numeric(10,2)
  into total_quantity, total_value from priced;

  if total_quantity < 1 or total_quantity > 30
     or total_quantity <> (
       select coalesce(sum((entry->>'quantity')::integer), 0)::integer
       from jsonb_array_elements(requested_items) entry
     ) then
    raise exception 'Revise as fatias escolhidas e tente novamente';
  end if;

  select * into location_row from public.pickup_locations
  where active order by sort_order, created_at limit 1;

  insert into public.instant_orders (
    order_number, public_token_hash, profile_id, customer_name, customer_phone,
    status, checkout_mode, subtotal, total, pickup_location_id, pickup_label,
    pickup_address, customer_notes, reserved_until, created_by
  ) values (
    '', private.instant_order_hash(raw_token), (select auth.uid()),
    btrim(requested_customer_name), '+' || normalized_phone,
    case when automatic_checkout_enabled and total_quantity >= automatic_threshold
      then 'reserved' else 'awaiting_confirmation' end,
    case when automatic_checkout_enabled and total_quantity >= automatic_threshold
      then 'automatic' else 'staff_confirmation' end,
    total_value, total_value, location_row.id, coalesce(location_row.public_label, ''),
    coalesce(location_row.address_text, ''), left(btrim(coalesce(requested_notes, '')), 1000),
    case when automatic_checkout_enabled and total_quantity >= automatic_threshold
      then now() + make_interval(mins => reservation_minutes) else null end,
    (select auth.uid())
  ) returning * into order_row;

  insert into public.instant_order_items (
    order_id, flavor_id, flavor_name, unit_price, quantity, status
  )
  select order_row.id, requested.flavor_id, flavor.name,
    flavor.base_price::numeric(10,2), requested.quantity, 'selected'
  from (
    select (entry->>'flavor_id')::uuid flavor_id, sum((entry->>'quantity')::integer)::integer quantity
    from jsonb_array_elements(requested_items) entry
    group by (entry->>'flavor_id')::uuid
  ) requested
  join public.flavors flavor on flavor.id = requested.flavor_id and flavor.active;

  if automatic_checkout_enabled and total_quantity >= automatic_threshold then
    conflicts := private.reserve_instant_order_stock(order_row.id);
    if jsonb_array_length(conflicts) > 0 then
      update public.instant_orders
      set status = 'cancelled', cancellation_reason = 'Estoque alterado durante o pedido',
          reserved_until = null, updated_at = now()
      where id = order_row.id;
      return jsonb_build_object(
        'accepted', false,
        'conflicts', conflicts,
        'message', 'Alguma fatia acabou de ser escolhida por outra pessoa. Veja as opções disponíveis e monte o pedido novamente.'
      );
    end if;
  end if;

  insert into public.outbox_events(topic, aggregate_type, aggregate_id, payload)
  values ('instant_order.created', 'instant_order', order_row.id,
    jsonb_build_object('order_number', order_row.order_number, 'quantity', total_quantity,
      'checkout_mode', order_row.checkout_mode, 'total', total_value));

  return jsonb_build_object(
    'accepted', true,
    'order_number', order_row.order_number,
    'token', raw_token,
    'status', order_row.status,
    'checkout_mode', order_row.checkout_mode,
    'total', order_row.total,
    'reserved_until', order_row.reserved_until,
    'pickup_label', order_row.pickup_label,
    'pickup_address', order_row.pickup_address,
    'message', case
      when automatic_checkout_enabled and total_quantity >= automatic_threshold then
        'As fatias foram separadas enquanto preparamos o pagamento.'
      else
        'Recebemos seu pedido. A Adoce vai conferir a disponibilidade e responder pelo WhatsApp.'
    end
  );
end;
$$;

revoke all on function public.submit_instant_order(text,text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.submit_instant_order(text,text,jsonb,text)
  to anon, authenticated;

create or replace function public.get_instant_order(order_code text, order_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_number', target.order_number,
    'status', target.status,
    'payment_status', target.payment_status,
    'total', target.total,
    'payment_url', target.payment_url,
    'payment_expires_at', target.payment_expires_at,
    'reserved_until', target.reserved_until,
    'pickup_label', target.pickup_label,
    'pickup_address', target.pickup_address,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'name', item.flavor_name, 'quantity', item.quantity,
      'unit_price', item.unit_price, 'status', item.status
    ) order by item.created_at) from public.instant_order_items item
      where item.order_id = target.id), '[]'::jsonb)
  )
  from public.instant_orders target
  where target.order_number = upper(btrim(order_code))
    and target.public_token_hash = private.instant_order_hash(order_token);
$$;
revoke all on function public.get_instant_order(text,text) from public, anon, authenticated;
grant execute on function public.get_instant_order(text,text) to anon, authenticated;

create or replace function public.staff_update_instant_order(
  target_order_id uuid,
  next_status text,
  next_payment_url text default null,
  next_payment_expires_at timestamptz default null,
  next_internal_notes text default null,
  next_cancellation_reason text default null
)
returns public.instant_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.instant_orders%rowtype;
  updated_order public.instant_orders%rowtype;
  conflicts jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  if next_status not in ('awaiting_confirmation','reserved','awaiting_payment','paid','preparing','ready','completed','cancelled','expired') then
    raise exception 'Status inválido';
  end if;
  select * into current_order from public.instant_orders where id = target_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;

  if current_order.status = 'awaiting_confirmation'
     and next_status in ('reserved', 'awaiting_payment') then
    conflicts := private.reserve_instant_order_stock(current_order.id);
    if jsonb_array_length(conflicts) > 0 then
      raise exception 'Não há estoque suficiente para confirmar este pedido';
    end if;
  end if;

  if next_status in ('cancelled', 'expired')
     and current_order.status in ('reserved', 'awaiting_payment') then
    perform private.release_instant_order_stock(current_order.id);
  end if;

  if next_status = 'paid' and current_order.status in ('reserved', 'awaiting_payment') then
    update public.flavor_availability availability
    set quantity_available = greatest(0, availability.quantity_available - item.quantity),
        quantity_reserved = greatest(0, availability.quantity_reserved - item.quantity),
        updated_at = now()
    from public.instant_order_items item
    where item.order_id = current_order.id and item.status = 'reserved'
      and availability.flavor_id = item.flavor_id
      and availability.service_date = (now() at time zone 'America/Fortaleza')::date
      and availability.quantity_available is not null;
    update public.instant_order_items set status = 'paid', updated_at = now()
      where order_id = current_order.id and status = 'reserved';
  end if;

  update public.instant_orders
  set status = next_status,
      payment_status = case
        when next_status = 'paid' then 'approved'
        when next_status = 'awaiting_payment' then 'pending'
        when next_status = 'expired' then 'expired'
        when next_status = 'cancelled' then 'cancelled'
        else payment_status end,
      payment_url = coalesce(nullif(btrim(next_payment_url), ''), payment_url),
      payment_expires_at = coalesce(next_payment_expires_at, payment_expires_at),
      internal_notes = coalesce(next_internal_notes, internal_notes),
      cancellation_reason = case when next_status in ('cancelled','expired')
        then coalesce(nullif(btrim(next_cancellation_reason), ''), cancellation_reason) else cancellation_reason end,
      reserved_until = case
        when next_status in ('reserved','awaiting_payment') then coalesce(reserved_until, now() + interval '15 minutes')
        when next_status in ('paid','preparing','ready','completed','cancelled','expired') then null
        else reserved_until end,
      paid_at = case when next_status = 'paid' then coalesce(paid_at, now()) else paid_at end,
      ready_at = case when next_status = 'ready' then coalesce(ready_at, now()) else ready_at end,
      completed_at = case when next_status = 'completed' then coalesce(completed_at, now()) else completed_at end,
      updated_by = (select auth.uid()), updated_at = now()
  where id = current_order.id returning * into updated_order;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'instant_order.status_changed', 'instant_order', updated_order.id::text,
    jsonb_build_object('from_status', current_order.status, 'status', next_status,
      'order_number', updated_order.order_number));
  return updated_order;
end;
$$;
revoke all on function public.staff_update_instant_order(uuid,text,text,timestamptz,text,text)
  from public, anon, authenticated;
grant execute on function public.staff_update_instant_order(uuid,text,text,timestamptz,text,text)
  to authenticated;

create or replace function public.expire_instant_order_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  expired_count integer := 0;
begin
  for target in
    select id from public.instant_orders
    where status in ('reserved','awaiting_payment') and reserved_until < now()
    for update skip locked
  loop
    perform private.release_instant_order_stock(target.id);
    update public.instant_orders set status = 'expired', payment_status = 'expired',
      reserved_until = null, cancellation_reason = 'Prazo de pagamento encerrado', updated_at = now()
    where id = target.id;
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;
revoke all on function public.expire_instant_order_reservations() from public, anon, authenticated;
grant execute on function public.expire_instant_order_reservations() to service_role;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'expire-instant-order-reservations',
  '* * * * *',
  'select public.expire_instant_order_reservations()'
);

create or replace function private.instant_order_operation_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.operation_notifications(event_type, priority, title, message, action_url, entity_type, entity_id)
    values ('instant_order.created',
      case when new.checkout_mode = 'automatic' then 'urgent' else 'important' end,
      'Novo pedido de fatias',
      new.order_number || ' · ' || new.customer_name || ' · ' || new.total::text,
      '/#operacao/vendas', 'instant_order', new.id);
  elsif new.status is distinct from old.status then
    insert into public.operation_notifications(event_type, priority, title, message, action_url, entity_type, entity_id)
    values ('instant_order.status_changed', 'important', 'Pedido atualizado',
      new.order_number || ' agora está como ' || new.status,
      '/#operacao/vendas', 'instant_order', new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.instant_order_operation_notification() from public, anon, authenticated;

drop trigger if exists instant_orders_operation_notification on public.instant_orders;
create trigger instant_orders_operation_notification
after insert or update of status on public.instant_orders
for each row execute function private.instant_order_operation_notification();

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'instant_orders'
  ) then
    alter publication supabase_realtime add table public.instant_orders;
  end if;
end $$;

alter table public.site_analytics_events
  drop constraint if exists site_analytics_events_event_name_check;
alter table public.site_analytics_events
  add constraint site_analytics_events_event_name_check check (event_name in (
    'page_view', 'whatsapp_click', 'product_view', 'prebook_start',
    'prebook_submit', 'prebook_success', 'prebook_error', 'schedule_open',
    'pede_junto_start', 'club_join_start', 'instant_order_open',
    'instant_order_start', 'instant_order_success'
  ));

create or replace function public.record_site_analytics_event(
  requested_event_id uuid,
  requested_event_name text,
  requested_page_path text,
  requested_properties jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_properties jsonb;
begin
  if requested_event_id is null
    or requested_event_name not in (
      'page_view', 'whatsapp_click', 'product_view', 'prebook_start',
      'prebook_submit', 'prebook_success', 'prebook_error', 'schedule_open',
      'pede_junto_start', 'club_join_start', 'instant_order_open',
      'instant_order_start', 'instant_order_success'
    )
    or requested_page_path is null
    or char_length(requested_page_path) not between 1 and 160
  then return false; end if;

  safe_properties := coalesce(requested_properties, '{}'::jsonb);
  if jsonb_typeof(safe_properties) <> 'object' or octet_length(safe_properties::text) > 1200 then
    return false;
  end if;
  safe_properties := jsonb_strip_nulls(jsonb_build_object(
    'segment', safe_properties -> 'segment',
    'product_id', safe_properties -> 'product_id',
    'product_slug', safe_properties -> 'product_slug',
    'source', safe_properties -> 'source',
    'channel', safe_properties -> 'channel',
    'result', safe_properties -> 'result',
    'device', safe_properties -> 'device',
    'quantity', safe_properties -> 'quantity',
    'checkout_mode', safe_properties -> 'checkout_mode'
  ));
  insert into public.site_analytics_events(event_id, event_name, page_path, properties)
  values (requested_event_id, requested_event_name, requested_page_path, safe_properties)
  on conflict (event_id) do nothing;
  return true;
end;
$$;
revoke all on function public.record_site_analytics_event(uuid,text,text,jsonb) from public;
grant execute on function public.record_site_analytics_event(uuid,text,text,jsonb) to anon, authenticated;
