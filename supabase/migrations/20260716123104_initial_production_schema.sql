create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.account_kind as enum ('individual', 'group');
create type public.membership_role as enum ('owner', 'member');
create type public.redemption_policy as enum ('any_member', 'owner_approval');
create type public.track_kind as enum ('main', 'referral');
create type public.reward_status as enum ('available', 'redeemed', 'reversed');
create type public.staff_role as enum ('owner', 'manager', 'attendant', 'viewer');
create type public.ledger_reason as enum (
  'purchase', 'referral_referred', 'referral_referrer', 'manual_adjustment',
  'reversal', 'reward_redeemed'
);
create type public.referral_status as enum ('pending', 'confirmed', 'reversed', 'rejected');
create type public.channel_status as enum ('open', 'closed', 'opening_soon', 'paused');
create type public.availability_status as enum (
  'available', 'last_units', 'sold_out', 'preorder_only', 'unavailable'
);
create type public.outbox_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  phone_e164 text unique,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null check (consent_type in ('club_terms', 'privacy', 'marketing')),
  granted boolean not null,
  document_version text not null,
  source text not null default 'web',
  created_at timestamptz not null default now()
);

create table public.staff_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.staff_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  kind public.account_kind not null,
  name text not null check (char_length(trim(name)) between 2 and 120),
  owner_profile_id uuid not null references public.profiles(id),
  redemption_policy public.redemption_policy not null default 'owner_approval',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_memberships (
  account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null default 'member',
  is_primary boolean not null default false,
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (account_id, profile_id)
);
create unique index account_memberships_one_primary
  on public.account_memberships(profile_id) where is_primary and active;

create table public.loyalty_tracks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  kind public.track_kind not null,
  current_progress smallint not null default 0 check (current_progress between 0 and 13),
  completed_cards integer not null default 0 check (completed_cards >= 0),
  redeemed_rewards integer not null default 0 check (redeemed_rewards >= 0),
  updated_at timestamptz not null default now(),
  unique (account_id, kind)
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.loyalty_tracks(id),
  source_cycle integer not null check (source_cycle > 0),
  status public.reward_status not null default 'available',
  reward_kind text not null default 'traditional_slice'
    check (reward_kind = 'traditional_slice'),
  issued_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references public.staff_members(user_id),
  premium_upgrade boolean not null default false,
  price_difference numeric(10,2) check (price_difference is null or price_difference >= 0),
  redemption_idempotency_key text unique,
  reversed_at timestamptz,
  unique (track_id, source_cycle)
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.loyalty_tracks(id),
  subject_profile_id uuid references public.profiles(id),
  actor_user_id uuid references auth.users(id),
  reason public.ledger_reason not null,
  stamps_delta smallint not null,
  resulting_progress smallint not null check (resulting_progress between 0 and 13),
  resulting_completed_cards integer not null check (resulting_completed_cards >= 0),
  idempotency_key text not null unique,
  related_entry_id uuid references public.ledger_entries(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.referral_codes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique check (code = upper(code)),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_profile_id uuid not null references public.profiles(id),
  referred_profile_id uuid not null unique references public.profiles(id),
  code text not null,
  status public.referral_status not null default 'pending',
  first_purchase_ledger_id uuid references public.ledger_entries(id),
  confirmed_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  check (referrer_profile_id <> referred_profile_id)
);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.wallet_passes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  provider text not null check (provider in ('apple', 'google')),
  provider_object_id text unique,
  serial_number text not null unique,
  qr_token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked', 'error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, account_id, provider)
);

create table public.store_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug in ('store', 'in_person', 'online_orders', 'preorders')),
  label text not null,
  status public.channel_status not null default 'closed',
  message text,
  next_change_at timestamptz,
  updated_by uuid references public.staff_members(user_id),
  updated_at timestamptz not null default now()
);

create table public.flavors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null check (category in ('traditional', 'premium')),
  description text,
  image_path text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.flavor_availability (
  id uuid primary key default gen_random_uuid(),
  flavor_id uuid not null references public.flavors(id) on delete cascade,
  service_date date not null default current_date,
  status public.availability_status not null,
  note text,
  updated_by uuid references public.staff_members(user_id),
  updated_at timestamptz not null default now(),
  unique (flavor_id, service_date)
);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  image_path text,
  audience jsonb not null default '{"type":"all"}'::jsonb,
  starts_at timestamptz not null,
  ends_at timestamptz,
  active boolean not null default false,
  created_by uuid references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  request_id text,
  ip_hash text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.outbox_events (
  id bigint generated always as identity primary key,
  topic text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index ledger_entries_track_created_idx on public.ledger_entries(track_id, created_at desc);
create index rewards_track_status_idx on public.rewards(track_id, status);
create index memberships_profile_idx on public.account_memberships(profile_id) where active;
create index referrals_referrer_idx on public.referrals(referrer_profile_id, status);
create index availability_date_idx on public.flavor_availability(service_date, status);
create index promotions_window_idx on public.promotions(active, starts_at, ends_at);
create index outbox_pending_idx on public.outbox_events(status, available_at) where status in ('pending', 'failed');

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members s
    where s.user_id = (select auth.uid()) and s.active
  );
$$;

create or replace function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members s
    where s.user_id = (select auth.uid()) and s.active
      and s.role in ('owner', 'manager')
  );
$$;

create or replace function private.is_account_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_memberships m
    where m.account_id = target_account_id
      and m.profile_id = (select auth.uid())
      and m.active
  );
$$;

revoke all on function private.is_staff() from public;
revoke all on function private.is_manager() from public;
revoke all on function private.is_account_member(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_manager() to authenticated;
grant execute on function private.is_account_member(uuid) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_account_id uuid;
  display_name text;
  new_code text;
begin
  display_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Cliente Adoce');
  insert into public.profiles(id, full_name, phone_e164, email)
  values (new.id, display_name, new.phone, new.email);

  insert into public.loyalty_accounts(kind, name, owner_profile_id)
  values ('individual', display_name, new.id)
  returning id into new_account_id;

  insert into public.account_memberships(account_id, profile_id, role, is_primary)
  values (new_account_id, new.id, 'owner', true);

  insert into public.loyalty_tracks(account_id, kind)
  values (new_account_id, 'main'), (new_account_id, 'referral');

  new_code := 'ADOCE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.referral_codes(profile_id, code) values (new.id, new_code);
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.advance_track(
  target_track_id uuid,
  points smallint,
  subject_id uuid,
  operation_reason public.ledger_reason,
  operation_key text,
  operation_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  track_row public.loyalty_tracks%rowtype;
  total_points integer;
  cycles integer;
  new_progress smallint;
  start_cycle integer;
  entry_id uuid;
  result jsonb;
begin
  if points <= 0 or points > 50 then
    raise exception 'Quantidade de carimbos inválida';
  end if;

  select metadata -> 'result' into result
  from public.ledger_entries where idempotency_key = operation_key;
  if found then return result; end if;

  select * into track_row from public.loyalty_tracks
  where id = target_track_id for update;
  if not found then raise exception 'Trilha não encontrada'; end if;

  total_points := track_row.current_progress + points;
  cycles := total_points / 14;
  new_progress := (total_points % 14)::smallint;
  start_cycle := track_row.completed_cards;

  update public.loyalty_tracks
  set current_progress = new_progress,
      completed_cards = completed_cards + cycles,
      updated_at = now()
  where id = target_track_id;

  if cycles > 0 then
    insert into public.rewards(track_id, source_cycle)
    select target_track_id, start_cycle + n
    from generate_series(1, cycles) as n;
  end if;

  result := jsonb_build_object(
    'track_id', target_track_id,
    'progress', new_progress,
    'completed_cards', start_cycle + cycles,
    'new_rewards', cycles
  );

  insert into public.ledger_entries(
    track_id, subject_profile_id, actor_user_id, reason, stamps_delta,
    resulting_progress, resulting_completed_cards, idempotency_key, metadata
  ) values (
    target_track_id, subject_id, (select auth.uid()), operation_reason, points,
    new_progress, start_cycle + cycles, operation_key,
    operation_metadata || jsonb_build_object('result', result)
  ) returning id into entry_id;

  insert into public.outbox_events(topic, aggregate_type, aggregate_id, payload)
  values ('loyalty.changed', 'loyalty_track', target_track_id,
    jsonb_build_object('ledger_entry_id', entry_id));

  return result || jsonb_build_object('ledger_entry_id', entry_id);
end;
$$;
revoke all on function private.advance_track(uuid,smallint,uuid,public.ledger_reason,text,jsonb)
  from public, anon, authenticated;

create or replace function public.staff_record_purchase(
  account_id uuid,
  participant_profile_id uuid,
  quantity smallint,
  idempotency_key text,
  referral_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  main_track_id uuid;
  purchase_result jsonb;
  referrer_id uuid;
  referrer_track_id uuid;
  purchase_entry_id uuid;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  if idempotency_key is null or char_length(idempotency_key) < 12 then
    raise exception 'Chave de idempotência inválida';
  end if;
  if not exists (
    select 1 from public.account_memberships m
    where m.account_id = staff_record_purchase.account_id
      and m.profile_id = participant_profile_id and m.active
  ) then raise exception 'Participante não pertence à conta'; end if;

  select id into main_track_id from public.loyalty_tracks
  where loyalty_tracks.account_id = staff_record_purchase.account_id and kind = 'main';

  purchase_result := private.advance_track(
    main_track_id, quantity, participant_profile_id, 'purchase',
    idempotency_key, jsonb_build_object('quantity', quantity)
  );
  purchase_entry_id := (purchase_result ->> 'ledger_entry_id')::uuid;

  if referral_code is not null
     and not exists (select 1 from public.referrals where referred_profile_id = participant_profile_id)
     and (select count(*) from public.ledger_entries
          where subject_profile_id = participant_profile_id and reason = 'purchase') = 1 then

    select profile_id into referrer_id from public.referral_codes
    where code = upper(trim(referral_code)) and active and profile_id <> participant_profile_id;

    if referrer_id is not null then
      insert into public.referrals(
        referrer_profile_id, referred_profile_id, code, status,
        first_purchase_ledger_id, confirmed_at
      ) values (
        referrer_id, participant_profile_id, upper(trim(referral_code)), 'confirmed',
        purchase_entry_id, now()
      );

      perform private.advance_track(
        main_track_id, 1, participant_profile_id, 'referral_referred',
        idempotency_key || ':referred', jsonb_build_object('referrer_id', referrer_id)
      );

      select t.id into referrer_track_id
      from public.loyalty_tracks t
      join public.account_memberships m on m.account_id = t.account_id
      where m.profile_id = referrer_id and m.is_primary and m.active and t.kind = 'referral';

      perform private.advance_track(
        referrer_track_id, 1, referrer_id, 'referral_referrer',
        idempotency_key || ':referrer', jsonb_build_object('referred_profile_id', participant_profile_id)
      );
    end if;
  end if;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'purchase.recorded', 'loyalty_account', account_id::text,
    jsonb_build_object('quantity', quantity, 'participant_profile_id', participant_profile_id));

  return purchase_result;
end;
$$;

create or replace function public.staff_redeem_reward(
  reward_id uuid,
  premium_upgrade boolean,
  price_difference numeric,
  idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reward_row public.rewards%rowtype;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  if idempotency_key is null or char_length(idempotency_key) < 12 then
    raise exception 'Chave de idempotência inválida';
  end if;
  if premium_upgrade and (price_difference is null or price_difference < 0) then
    raise exception 'Diferença da fatia premium inválida';
  end if;

  select * into reward_row from public.rewards
  where id = reward_id for update;
  if not found then raise exception 'Prêmio não encontrado'; end if;

  if reward_row.redemption_idempotency_key = idempotency_key then
    return jsonb_build_object('reward_id', reward_id, 'status', reward_row.status);
  end if;
  if reward_row.status <> 'available' then raise exception 'Prêmio indisponível'; end if;

  update public.rewards set
    status = 'redeemed', redeemed_at = now(), redeemed_by = (select auth.uid()),
    premium_upgrade = staff_redeem_reward.premium_upgrade,
    price_difference = case when premium_upgrade then staff_redeem_reward.price_difference else 0 end,
    redemption_idempotency_key = idempotency_key
  where id = reward_id;

  update public.loyalty_tracks set
    redeemed_rewards = redeemed_rewards + 1, updated_at = now()
  where id = reward_row.track_id;

  insert into public.ledger_entries(
    track_id, actor_user_id, reason, stamps_delta, resulting_progress,
    resulting_completed_cards, idempotency_key, metadata
  )
  select id, (select auth.uid()), 'reward_redeemed', 0, current_progress,
    completed_cards, idempotency_key,
    jsonb_build_object('reward_id', reward_id, 'premium_upgrade', premium_upgrade,
      'price_difference', case when premium_upgrade then price_difference else 0 end)
  from public.loyalty_tracks where id = reward_row.track_id;

  insert into public.outbox_events(topic, aggregate_type, aggregate_id, payload)
  values ('reward.redeemed', 'reward', reward_id,
    jsonb_build_object('track_id', reward_row.track_id));

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'reward.redeemed', 'reward', reward_id::text,
    jsonb_build_object('premium_upgrade', premium_upgrade, 'price_difference', price_difference));

  return jsonb_build_object('reward_id', reward_id, 'status', 'redeemed');
end;
$$;

revoke all on function public.staff_record_purchase(uuid,uuid,smallint,text,text) from public, anon;
revoke all on function public.staff_redeem_reward(uuid,boolean,numeric,text) from public, anon;
grant execute on function public.staff_record_purchase(uuid,uuid,smallint,text,text) to authenticated;
grant execute on function public.staff_redeem_reward(uuid,boolean,numeric,text) to authenticated;

alter table public.profiles enable row level security;
alter table public.consent_events enable row level security;
alter table public.staff_members enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.account_memberships enable row level security;
alter table public.loyalty_tracks enable row level security;
alter table public.rewards enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.group_invites enable row level security;
alter table public.wallet_passes enable row level security;
alter table public.store_channels enable row level security;
alter table public.flavors enable row level security;
alter table public.flavor_availability enable row level security;
alter table public.promotions enable row level security;
alter table public.audit_events enable row level security;
alter table public.outbox_events enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_staff());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy consents_read on public.consent_events for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_staff());
create policy consents_insert_own on public.consent_events for insert to authenticated
  with check (profile_id = (select auth.uid()));

create policy staff_read on public.staff_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_manager());

create policy accounts_read on public.loyalty_accounts for select to authenticated
  using (private.is_account_member(id) or private.is_staff());
create policy memberships_read on public.account_memberships for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_account_member(account_id) or private.is_staff());
create policy tracks_read on public.loyalty_tracks for select to authenticated
  using (private.is_account_member(account_id) or private.is_staff());
create policy rewards_read on public.rewards for select to authenticated
  using (exists (
    select 1 from public.loyalty_tracks t
    where t.id = rewards.track_id and (private.is_account_member(t.account_id) or private.is_staff())
  ));
create policy ledger_read on public.ledger_entries for select to authenticated
  using (exists (
    select 1 from public.loyalty_tracks t
    where t.id = ledger_entries.track_id and (private.is_account_member(t.account_id) or private.is_staff())
  ));
create policy referral_codes_read on public.referral_codes for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_staff());
create policy referrals_read on public.referrals for select to authenticated
  using (referrer_profile_id = (select auth.uid()) or referred_profile_id = (select auth.uid()) or private.is_staff());
create policy group_invites_read on public.group_invites for select to authenticated
  using (private.is_account_member(account_id) or private.is_staff());
create policy wallet_passes_read on public.wallet_passes for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_staff());

create policy channels_public_read on public.store_channels for select to anon, authenticated using (true);
create policy flavors_public_read on public.flavors for select to anon, authenticated using (active);
create policy availability_public_read on public.flavor_availability for select to anon, authenticated
  using (service_date >= current_date - 1);
create policy promotions_public_read on public.promotions for select to anon, authenticated
  using (active and starts_at <= now() and (ends_at is null or ends_at > now()));

create policy channels_staff_all on public.store_channels for all to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy flavors_staff_all on public.flavors for all to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy availability_staff_all on public.flavor_availability for all to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy promotions_staff_all on public.promotions for all to authenticated
  using (private.is_manager()) with check (private.is_manager());
create policy audit_staff_read on public.audit_events for select to authenticated
  using (private.is_manager());

grant select on public.profiles to authenticated;
grant update(full_name) on public.profiles to authenticated;
grant select, insert on public.consent_events to authenticated;
grant select on public.staff_members, public.loyalty_accounts, public.account_memberships,
  public.loyalty_tracks, public.rewards, public.ledger_entries, public.referral_codes,
  public.referrals, public.group_invites, public.wallet_passes to authenticated;
grant select on public.store_channels, public.flavors, public.flavor_availability, public.promotions
  to anon, authenticated;
grant insert, update, delete on public.store_channels, public.flavors,
  public.flavor_availability, public.promotions to authenticated;
grant select on public.audit_events to authenticated;

insert into public.store_channels(slug, label, status, message) values
  ('store', 'Loja física', 'closed', 'Consulte nossos horários.'),
  ('in_person', 'Atendimento presencial', 'closed', 'Ainda não iniciado.'),
  ('online_orders', 'Pedidos online', 'closed', 'Indisponíveis no momento.'),
  ('preorders', 'Encomendas', 'closed', 'Consulte disponibilidade.')
on conflict (slug) do nothing;