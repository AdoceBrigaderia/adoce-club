create table if not exists public.beta_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp text not null,
  whatsapp_digits text not null unique,
  email text,
  instagram text,
  birth_date date,
  password_salt text not null,
  password_hash text not null,
  lgpd_accepted_at timestamptz not null,
  beta_accepted_at timestamptz not null,
  accepts_promotions boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.beta_customer_sessions (
  token_hash text primary key,
  customer_id uuid not null references public.beta_customers(id) on delete cascade,
  user_agent text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create table if not exists public.beta_loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.beta_customers(id) on delete cascade,
  stamps integer not null default 0 check (stamps >= 0),
  stamps_required integer not null default 14 check (stamps_required > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.beta_loyalty_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.beta_customers(id) on delete cascade,
  sale_id uuid,
  event_type text not null check (event_type in ('purchase','redeem','adjustment','reversal','referral')),
  stamps integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.beta_sales (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  operator_id text,
  operator_name text,
  customer_id uuid references public.beta_customers(id),
  qty integer not null check (qty > 0),
  flavor text,
  syrup text,
  payment_method text not null,
  sale_kind text not null,
  status text not null default 'paid',
  gross_amount numeric(12,2) not null default 0,
  generates_stamps boolean not null default true,
  claimed_at timestamptz,
  claimed_by uuid references public.beta_customers(id),
  created_at timestamptz not null default now()
);

create index if not exists beta_sales_token_idx on public.beta_sales(token);
create index if not exists beta_events_customer_idx on public.beta_loyalty_events(customer_id, created_at desc);

alter table public.beta_customers enable row level security;
alter table public.beta_customer_sessions enable row level security;
alter table public.beta_loyalty_cards enable row level security;
alter table public.beta_loyalty_events enable row level security;
alter table public.beta_sales enable row level security;
