create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('client','operator','manager','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cash_session_type as enum ('festival','leftovers');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cash_session_status as enum ('open','closing','closed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sale_channel as enum ('in_person','online','whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash','pix','card','mercado_pago_point','mercado_pago_link','courtesy','barter','loyalty','customer_credit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('manual_confirmed','created','sent_to_terminal','link_sent','waiting_payment','paid','declined','cancelled','expired','refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'cart',
    'received',
    'separating',
    'waiting_customer_adjustment',
    'confirmed_for_payment',
    'link_sent',
    'waiting_payment',
    'paid',
    'waiting_syrup_choice',
    'syrups_chosen',
    'preparing',
    'waiting_pickup',
    'waiting_app_collection',
    'delivered',
    'suspended',
    'cancelled',
    'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pickup_type as enum ('customer','app_driver');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.credit_status as enum ('active','used','expired','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.print_job_status as enum ('queued','printed','failed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  phone text,
  instagram text,
  birth_date date,
  role public.user_role not null default 'client',
  active boolean not null default true,
  referral_code text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  referred_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_locations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('festival','commercial_pickup','production')),
  name text not null,
  address text not null,
  neighborhood text,
  city text,
  state text,
  zip_code text,
  reference text,
  latitude numeric,
  longitude numeric,
  maps_url text,
  waze_url text,
  opening_hours text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'Adoce Brigaderia',
  slice_price numeric(12,2) not null default 16,
  average_slice_cost numeric(12,2) not null default 6.67,
  stamps_required integer not null default 14 check (stamps_required > 0),
  reward_validity_days integer not null default 30,
  referral_bonus_stamps integer not null default 1,
  birthday_discount_enabled boolean not null default true,
  birthday_discount_cap_percent numeric(5,2) not null default 20,
  family_card_enabled boolean not null default true,
  lucky_slice_enabled boolean not null default true,
  whatsapp text,
  instagram text,
  updated_at timestamptz not null default now()
);

create table if not exists public.flavors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  image_url text,
  default_slices_per_pie integer not null default 12 check (default_slices_per_pie > 0),
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  device_kind text not null default 'web',
  default_operator_id uuid references public.profiles(id),
  default_terminal_id uuid,
  counter_mode boolean not null default false,
  printer_enabled boolean not null default false,
  printer_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.mercado_pago_terminals (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  operator_id uuid references public.profiles(id),
  mercado_pago_terminal_id text,
  store_id text,
  pos_id text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.devices
  drop constraint if exists devices_default_terminal_id_fkey,
  add constraint devices_default_terminal_id_fkey
  foreign key (default_terminal_id) references public.mercado_pago_terminals(id);

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  session_type public.cash_session_type not null,
  status public.cash_session_status not null default 'open',
  business_date date not null default current_date,
  opened_by uuid references public.profiles(id),
  closed_by uuid references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_fund numeric(12,2) not null default 0 check (opening_fund >= 0),
  counted_cash numeric(12,2),
  expected_cash numeric(12,2),
  cash_difference numeric(12,2),
  notes text,
  previous_cash_session_id uuid references public.cash_sessions(id),
  created_at timestamptz not null default now()
);

create table if not exists public.cash_session_flavors (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references public.cash_sessions(id) on delete cascade,
  flavor_id uuid not null references public.flavors(id),
  pies_count numeric(8,2) not null default 0 check (pies_count >= 0),
  slices_per_pie integer not null default 12 check (slices_per_pie > 0),
  initial_slices integer not null default 0 check (initial_slices >= 0),
  expected_slices integer not null default 0,
  counted_closing_slices integer,
  difference_slices integer,
  notes text,
  unique(cash_session_id, flavor_id)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid references public.cash_sessions(id),
  customer_id uuid references public.profiles(id),
  operator_id uuid references public.profiles(id),
  channel public.sale_channel not null default 'in_person',
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'manual_confirmed',
  gross_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  fee_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  generates_qr boolean not null default false,
  generates_stamps boolean not null default false,
  token text unique,
  notes text,
  cancelled_at timestamptz,
  cancellation_reason text,
  cancelled_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  flavor_id uuid not null references public.flavors(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  total_amount numeric(12,2) generated always as (quantity * unit_price) stored
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.sales(id),
  method public.payment_method not null,
  status public.payment_status not null,
  amount numeric(12,2) not null default 0,
  fee_amount numeric(12,2) not null default 0,
  provider text,
  provider_reference text,
  payment_link_url text,
  cash_received numeric(12,2),
  change_due numeric(12,2),
  change_return_method text check (change_return_method in ('none','cash','pix','customer_credit') or change_return_method is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid references public.cash_sessions(id),
  sale_id uuid references public.sales(id),
  operator_id uuid references public.profiles(id),
  movement_type text not null check (movement_type in ('cash_in','cash_out','expense','pix_change','customer_credit_created','customer_credit_used','fee','adjustment')),
  amount numeric(12,2) not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_credits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id),
  origin_sale_id uuid references public.sales(id),
  used_sale_id uuid references public.sales(id),
  amount numeric(12,2) not null check (amount > 0),
  remaining_amount numeric(12,2) not null check (remaining_amount >= 0),
  origin text not null default 'troco incompleto',
  status public.credit_status not null default 'active',
  valid_until date,
  operator_id uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  owner_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid references public.families(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (family_id, profile_id)
);

create table if not exists public.loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete cascade,
  family_id uuid unique references public.families(id) on delete cascade,
  stamps integer not null default 0 check (stamps >= 0),
  stamps_required integer not null default 14 check (stamps_required > 0),
  created_at timestamptz not null default now(),
  check ((profile_id is null) <> (family_id is null))
);

create table if not exists public.loyalty_events (
  id uuid primary key default gen_random_uuid(),
  loyalty_card_id uuid not null references public.loyalty_cards(id),
  profile_id uuid references public.profiles(id),
  sale_id uuid references public.sales(id),
  event_type text not null check (event_type in ('purchase','referral','redeem','adjustment','reversal','lucky_slice')),
  stamps integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  loyalty_card_id uuid not null references public.loyalty_cards(id),
  customer_id uuid references public.profiles(id),
  reward_type text not null default '1 fatia gratis',
  origin text not null,
  status text not null default 'pending' check (status in ('pending','redeemed','expired','cancelled')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_sale_id uuid references public.sales(id),
  redeemed_at timestamptz,
  notes text
);

create table if not exists public.online_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null default ('AC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  customer_id uuid references public.profiles(id),
  customer_name text,
  customer_phone text,
  channel public.sale_channel not null default 'online',
  status public.order_status not null default 'received',
  payment_method public.payment_method default 'mercado_pago_link',
  payment_status public.payment_status default 'created',
  payment_link_url text,
  pickup_type public.pickup_type not null default 'customer',
  total_amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.online_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.online_orders(id) on delete cascade,
  flavor_id uuid not null references public.flavors(id),
  quantity integer not null check (quantity > 0),
  confirmed_quantity integer,
  unit_price numeric(12,2) not null default 0,
  notes text
);

create table if not exists public.order_slice_syrups (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.online_order_items(id) on delete cascade,
  slice_number integer not null check (slice_number > 0),
  syrup text not null check (syrup in ('Ninho','Brigadeiro')),
  unique(order_item_id, slice_number)
);

create table if not exists public.pickup_details (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.online_orders(id) on delete cascade,
  pickup_type public.pickup_type not null,
  app_name text,
  driver_name text,
  vehicle_model text,
  vehicle_color text,
  vehicle_plate text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid references public.cash_sessions(id),
  sale_id uuid references public.sales(id),
  order_id uuid references public.online_orders(id),
  customer_credit_id uuid references public.customer_credits(id),
  print_type text not null check (print_type in ('loyalty_qr','online_order','closing_summary','customer_credit','lucky_slice','pickup_label','sale_receipt')),
  status public.print_job_status not null default 'queued',
  payload jsonb not null default '{}',
  printed_at timestamptz,
  error_message text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists cash_sessions_business_date_idx on public.cash_sessions(business_date desc);
create index if not exists sales_created_at_idx on public.sales(created_at desc);
create index if not exists sale_items_sale_idx on public.sale_items(sale_id);
create index if not exists online_orders_status_idx on public.online_orders(status, created_at desc);
create index if not exists loyalty_events_card_idx on public.loyalty_events(loyalty_card_id, created_at desc);
create index if not exists print_jobs_status_idx on public.print_jobs(status, created_at desc);

alter table public.profiles enable row level security;
alter table public.business_locations enable row level security;
alter table public.app_settings enable row level security;
alter table public.flavors enable row level security;
alter table public.devices enable row level security;
alter table public.mercado_pago_terminals enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_session_flavors enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.cash_movements enable row level security;
alter table public.customer_credits enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.loyalty_cards enable row level security;
alter table public.loyalty_events enable row level security;
alter table public.rewards enable row level security;
alter table public.online_orders enable row level security;
alter table public.online_order_items enable row level security;
alter table public.order_slice_syrups enable row level security;
alter table public.pickup_details enable row level security;
alter table public.print_jobs enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('operator','manager','admin'), false)
$$;

drop policy if exists "public read app settings" on public.app_settings;
create policy "public read app settings" on public.app_settings
for select using (true);

drop policy if exists "public read active flavors" on public.flavors;
create policy "public read active flavors" on public.flavors
for select using (active = true or public.is_staff());

drop policy if exists "public read active locations" on public.business_locations;
create policy "public read active locations" on public.business_locations
for select using (active = true or public.is_staff());

drop policy if exists "profiles read own or staff" on public.profiles;
create policy "profiles read own or staff" on public.profiles
for select using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "staff manage settings" on public.app_settings;
create policy "staff manage settings" on public.app_settings
for all using (public.current_user_role() in ('manager','admin')) with check (public.current_user_role() in ('manager','admin'));

drop policy if exists "staff manage operational tables" on public.cash_sessions;
create policy "staff manage operational tables" on public.cash_sessions
for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage session flavors" on public.cash_session_flavors;
create policy "staff manage session flavors" on public.cash_session_flavors
for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage sales" on public.sales;
create policy "staff manage sales" on public.sales
for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage sale items" on public.sale_items;
create policy "staff manage sale items" on public.sale_items
for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage payments" on public.payments;
create policy "staff manage payments" on public.payments
for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage cash movements" on public.cash_movements;
create policy "staff manage cash movements" on public.cash_movements
for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage credits" on public.customer_credits;
create policy "staff manage credits" on public.customer_credits
for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage orders" on public.online_orders;
create policy "staff manage orders" on public.online_orders
for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "customer read own orders" on public.online_orders;
create policy "customer read own orders" on public.online_orders
for select using (customer_id = auth.uid());

drop policy if exists "staff manage order items" on public.online_order_items;
create policy "staff manage order items" on public.online_order_items
for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage syrups" on public.order_slice_syrups;
create policy "staff manage syrups" on public.order_slice_syrups
for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage pickup details" on public.pickup_details;
create policy "staff manage pickup details" on public.pickup_details
for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage print jobs" on public.print_jobs;
create policy "staff manage print jobs" on public.print_jobs
for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff read audit" on public.audit_logs;
create policy "staff read audit" on public.audit_logs
for select using (public.is_staff());

drop policy if exists "staff insert audit" on public.audit_logs;
create policy "staff insert audit" on public.audit_logs
for insert with check (public.is_staff());

drop policy if exists "family members read own" on public.families;
create policy "family members read own" on public.families
for select using (owner_id = auth.uid() or public.is_staff() or exists (
  select 1 from public.family_members m where m.family_id = families.id and m.profile_id = auth.uid()
));

drop policy if exists "loyalty cards read own" on public.loyalty_cards;
create policy "loyalty cards read own" on public.loyalty_cards
for select using (profile_id = auth.uid() or public.is_staff() or exists (
  select 1 from public.family_members m where m.family_id = loyalty_cards.family_id and m.profile_id = auth.uid()
));

drop policy if exists "loyalty events read own" on public.loyalty_events;
create policy "loyalty events read own" on public.loyalty_events
for select using (public.is_staff() or exists (
  select 1
  from public.loyalty_cards c
  left join public.family_members m on m.family_id = c.family_id
  where c.id = loyalty_events.loyalty_card_id
    and (c.profile_id = auth.uid() or m.profile_id = auth.uid())
));

drop policy if exists "rewards read own" on public.rewards;
create policy "rewards read own" on public.rewards
for select using (customer_id = auth.uid() or public.is_staff() or exists (
  select 1
  from public.loyalty_cards c
  left join public.family_members m on m.family_id = c.family_id
  where c.id = rewards.loyalty_card_id
    and (c.profile_id = auth.uid() or m.profile_id = auth.uid())
));

insert into public.app_settings (id, store_name, slice_price, average_slice_cost, stamps_required, whatsapp, instagram)
values (true, 'Adoce Brigaderia', 16, 6.67, 14, '(85) 99999-9999', '@adocebrigaderia')
on conflict (id) do nothing;

insert into public.flavors (name, display_order) values
  ('Ninho com Morango', 10),
  ('Brigadeiro Classico', 20),
  ('Beijinho', 30),
  ('Chocolate Belga', 40)
on conflict (name) do nothing;

insert into public.business_locations (kind, name, address, city, state, opening_hours)
values
  ('festival', 'Festival de Fatias Adoce Brigaderia', 'Endereco do festival', 'Fortaleza', 'CE', 'Quinta, sexta e sabado, 19h as 23h'),
  ('production', 'Producao Adoce Brigaderia', 'Endereco de producao', 'Fortaleza', 'CE', 'Segunda a sabado, 8h as 17h'),
  ('commercial_pickup', 'Retirada em horario comercial', 'Endereco de retirada comercial', 'Fortaleza', 'CE', 'Segunda a sabado, 8h as 17h')
on conflict do nothing;
