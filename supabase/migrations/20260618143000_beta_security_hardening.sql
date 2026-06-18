create table if not exists public.beta_staff_sessions (
  token_hash text primary key,
  operator_id text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);

create table if not exists public.beta_security_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists beta_security_events_key_created_idx
  on public.beta_security_events(event_key, created_at desc);

alter table public.beta_staff_sessions enable row level security;
alter table public.beta_security_events enable row level security;
