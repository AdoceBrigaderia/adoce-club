-- Foundation for official Meta/Instagram messaging integration.
-- No automation is enabled by this migration. Server-side feature flags and
-- valid Meta credentials are still required before events are accepted.

create table public.channel_accounts (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('instagram', 'whatsapp')),
  external_account_id text not null,
  display_name text,
  environment text not null default 'development'
    check (environment in ('development', 'staging', 'production')),
  active boolean not null default false,
  automation_enabled boolean not null default false,
  connected_at timestamptz,
  last_verified_at timestamptz,
  last_event_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, external_account_id, environment)
);

create table public.customer_channel_links (
  id uuid primary key default gen_random_uuid(),
  channel_account_id uuid not null references public.channel_accounts(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  external_user_id text not null,
  external_username text,
  link_status text not null default 'unverified'
    check (link_status in ('unverified', 'pending', 'verified', 'revoked')),
  verified_at timestamptz,
  verification_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_account_id, external_user_id)
);

create table public.channel_conversations (
  id uuid primary key default gen_random_uuid(),
  channel_account_id uuid not null references public.channel_accounts(id) on delete restrict,
  customer_channel_link_id uuid references public.customer_channel_links(id) on delete set null,
  external_conversation_id text not null,
  status text not null default 'open'
    check (status in ('open', 'waiting_customer', 'waiting_operation', 'resolved', 'expired', 'blocked')),
  automation_status text not null default 'active'
    check (automation_status in ('active', 'paused', 'handoff', 'disabled')),
  state text not null default 'INICIO',
  state_data jsonb not null default '{}'::jsonb,
  assigned_to uuid references public.staff_members(user_id) on delete set null,
  last_message_at timestamptz,
  message_window_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_account_id, external_conversation_id)
);

create table public.channel_external_events (
  id uuid primary key default gen_random_uuid(),
  channel_account_id uuid references public.channel_accounts(id) on delete set null,
  channel text not null check (channel in ('instagram', 'whatsapp')),
  external_event_id text not null,
  event_type text not null,
  correlation_id uuid not null default gen_random_uuid(),
  payload jsonb not null,
  payload_sha256 text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'processed', 'retrying', 'dead_letter', 'ignored')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error_code text,
  last_error_summary text,
  received_at timestamptz not null default now(),
  unique (channel, external_event_id)
);

create table public.channel_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.channel_conversations(id) on delete cascade,
  external_event_id uuid references public.channel_external_events(id) on delete set null,
  external_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null default 'text',
  body text,
  payload jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'received'
    check (delivery_status in ('received', 'pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'retrying', 'cancelled')),
  sent_by uuid references public.staff_members(user_id) on delete set null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  unique (conversation_id, external_message_id)
);

create table public.channel_outbox_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.channel_conversations(id) on delete cascade,
  message_id uuid references public.channel_messages(id) on delete set null,
  idempotency_key text not null unique,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'retrying', 'cancelled', 'dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_http_status integer,
  last_error_code text,
  last_error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index channel_links_profile_idx
  on public.customer_channel_links(profile_id)
  where profile_id is not null;
create index channel_conversations_work_idx
  on public.channel_conversations(status, last_message_at desc);
create index channel_external_events_pending_idx
  on public.channel_external_events(available_at, received_at)
  where status in ('pending', 'retrying');
create index channel_external_events_correlation_idx
  on public.channel_external_events(correlation_id);
create index channel_messages_conversation_idx
  on public.channel_messages(conversation_id, created_at desc);
create index channel_outbox_pending_idx
  on public.channel_outbox_messages(available_at, created_at)
  where status in ('pending', 'retrying');

alter table public.channel_accounts enable row level security;
alter table public.customer_channel_links enable row level security;
alter table public.channel_conversations enable row level security;
alter table public.channel_external_events enable row level security;
alter table public.channel_messages enable row level security;
alter table public.channel_outbox_messages enable row level security;

create policy channel_accounts_manager_read on public.channel_accounts
  for select to authenticated using ((select private.is_manager()));
create policy customer_channel_links_manager_read on public.customer_channel_links
  for select to authenticated using ((select private.is_manager()));
create policy channel_conversations_staff_read on public.channel_conversations
  for select to authenticated using ((select private.is_staff()));
create policy channel_external_events_manager_read on public.channel_external_events
  for select to authenticated using ((select private.is_manager()));
create policy channel_messages_staff_read on public.channel_messages
  for select to authenticated using ((select private.is_staff()));
create policy channel_outbox_manager_read on public.channel_outbox_messages
  for select to authenticated using ((select private.is_manager()));

revoke all on public.channel_accounts from public, anon;
revoke all on public.customer_channel_links from public, anon;
revoke all on public.channel_conversations from public, anon;
revoke all on public.channel_external_events from public, anon;
revoke all on public.channel_messages from public, anon;
revoke all on public.channel_outbox_messages from public, anon;

grant select on public.channel_accounts to authenticated;
grant select on public.customer_channel_links to authenticated;
grant select on public.channel_conversations to authenticated;
grant select on public.channel_external_events to authenticated;
grant select on public.channel_messages to authenticated;
grant select on public.channel_outbox_messages to authenticated;

create or replace function private.claim_channel_events(batch_size integer default 20)
returns setof public.channel_external_events
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    select event.id
    from public.channel_external_events event
    where event.status in ('pending', 'retrying')
      and event.available_at <= now()
    order by event.received_at
    for update skip locked
    limit greatest(1, least(batch_size, 100))
  )
  update public.channel_external_events event
  set status = 'processing',
      attempts = event.attempts + 1,
      locked_at = now()
  from claimed
  where event.id = claimed.id
  returning event.*;
$$;

revoke all on function private.claim_channel_events(integer) from public, anon, authenticated;
grant execute on function private.claim_channel_events(integer) to service_role;

comment on table public.channel_external_events is
  'Private, idempotent ingress queue for signed Meta channel webhooks.';
comment on table public.channel_outbox_messages is
  'Private transactional outbox. Creation does not imply delivery by Meta.';
