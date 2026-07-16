create table private.pilot_settings (
  singleton boolean primary key default true check (singleton),
  secret_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
revoke all on private.pilot_settings from public, anon, authenticated;

create table public.pilot_customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  phone_digits text not null unique check (phone_digits ~ '^[0-9]{10,11}$'),
  public_token uuid not null unique default gen_random_uuid(),
  current_progress smallint not null default 0 check (current_progress between 0 and 13),
  completed_cards integer not null default 0 check (completed_cards >= 0),
  available_rewards integer not null default 0 check (available_rewards >= 0),
  redeemed_rewards integer not null default 0 check (redeemed_rewards >= 0),
  migrated_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pilot_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.pilot_customers(id),
  kind text not null check (kind in ('enroll', 'purchase', 'redeem')),
  quantity smallint not null default 0,
  idempotency_key text not null unique,
  resulting_progress smallint not null check (resulting_progress between 0 and 13),
  resulting_completed_cards integer not null check (resulting_completed_cards >= 0),
  resulting_available_rewards integer not null check (resulting_available_rewards >= 0),
  created_at timestamptz not null default now()
);

create index pilot_customers_name_idx on public.pilot_customers(lower(full_name));
create index pilot_transactions_customer_idx on public.pilot_transactions(customer_id, created_at desc);
create index consent_events_profile_idx on public.consent_events(profile_id);
create index audit_events_actor_idx on public.audit_events(actor_user_id);
create index flavor_availability_updated_by_idx on public.flavor_availability(updated_by);
create index group_invites_account_idx on public.group_invites(account_id);
create index group_invites_created_by_idx on public.group_invites(created_by);
create index group_invites_accepted_by_idx on public.group_invites(accepted_by);
create index ledger_entries_subject_idx on public.ledger_entries(subject_profile_id);
create index ledger_entries_actor_idx on public.ledger_entries(actor_user_id);
create index ledger_entries_related_idx on public.ledger_entries(related_entry_id);
create index loyalty_accounts_owner_idx on public.loyalty_accounts(owner_profile_id);
create index promotions_created_by_idx on public.promotions(created_by);
create index referrals_first_purchase_idx on public.referrals(first_purchase_ledger_id);
create index rewards_redeemed_by_idx on public.rewards(redeemed_by);
create index store_channels_updated_by_idx on public.store_channels(updated_by);
create index wallet_passes_account_idx on public.wallet_passes(account_id);

alter table public.pilot_customers enable row level security;
alter table public.pilot_transactions enable row level security;
revoke all on public.pilot_customers, public.pilot_transactions from public, anon, authenticated;

create or replace function private.pilot_authorized(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.pilot_settings
    where singleton
      and expires_at > now()
      and secret_hash = extensions.crypt(candidate, secret_hash)
  );
$$;
revoke all on function private.pilot_authorized(text) from public, anon, authenticated;

create or replace function public.pilot_enroll_customer(
  staff_code text,
  customer_name text,
  customer_phone text,
  operation_key text
)
returns table (
  customer_id uuid,
  public_token uuid,
  full_name text,
  current_progress smallint,
  completed_cards integer,
  available_rewards integer,
  redeemed_rewards integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_phone text;
  row_data public.pilot_customers%rowtype;
begin
  if not private.pilot_authorized(staff_code) then raise exception 'Acesso inválido'; end if;
  if operation_key is null or char_length(operation_key) < 12 then raise exception 'Operação inválida'; end if;
  normalized_phone := regexp_replace(customer_phone, '[^0-9]', '', 'g');
  if left(normalized_phone, 2) = '55' and char_length(normalized_phone) in (12,13) then
    normalized_phone := substring(normalized_phone from 3);
  end if;
  if char_length(normalized_phone) not in (10,11) then raise exception 'Telefone inválido'; end if;
  if char_length(trim(customer_name)) < 2 then raise exception 'Nome inválido'; end if;

  select * into row_data from public.pilot_customers where phone_digits = normalized_phone;
  if not found then
    insert into public.pilot_customers(full_name, phone_digits)
    values (trim(customer_name), normalized_phone)
    returning * into row_data;
    insert into public.pilot_transactions(
      customer_id, kind, idempotency_key, resulting_progress,
      resulting_completed_cards, resulting_available_rewards
    ) values (
      row_data.id, 'enroll', operation_key, 0, 0, 0
    );
  end if;

  return query select row_data.id, row_data.public_token, row_data.full_name,
    row_data.current_progress, row_data.completed_cards,
    row_data.available_rewards, row_data.redeemed_rewards;
end;
$$;

create or replace function public.pilot_search_customers(
  staff_code text,
  search_text text
)
returns table (
  customer_id uuid,
  public_token uuid,
  full_name text,
  phone_digits text,
  current_progress smallint,
  completed_cards integer,
  available_rewards integer,
  redeemed_rewards integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.pilot_authorized(staff_code) then raise exception 'Acesso inválido'; end if;
  return query
  select c.id, c.public_token, c.full_name, c.phone_digits, c.current_progress,
    c.completed_cards, c.available_rewards, c.redeemed_rewards
  from public.pilot_customers c
  where lower(c.full_name) like '%' || lower(trim(search_text)) || '%'
     or c.phone_digits like '%' || regexp_replace(search_text, '[^0-9]', '', 'g') || '%'
  order by c.updated_at desc
  limit 20;
end;
$$;

create or replace function public.pilot_record_purchase(
  staff_code text,
  target_customer_id uuid,
  quantity smallint,
  operation_key text
)
returns table (
  customer_id uuid,
  public_token uuid,
  full_name text,
  current_progress smallint,
  completed_cards integer,
  available_rewards integer,
  redeemed_rewards integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data public.pilot_customers%rowtype;
  total_points integer;
  new_cycles integer;
begin
  if not private.pilot_authorized(staff_code) then raise exception 'Acesso inválido'; end if;
  if quantity < 1 or quantity > 30 then raise exception 'Quantidade inválida'; end if;
  if operation_key is null or char_length(operation_key) < 12 then raise exception 'Operação inválida'; end if;

  if exists (select 1 from public.pilot_transactions where idempotency_key = operation_key) then
    select c.* into row_data from public.pilot_customers c where c.id = target_customer_id;
  else
    select * into row_data from public.pilot_customers where id = target_customer_id for update;
    if not found then raise exception 'Cliente não encontrado'; end if;
    total_points := row_data.current_progress + quantity;
    new_cycles := total_points / 14;
    update public.pilot_customers c set
      current_progress = (total_points % 14)::smallint,
      completed_cards = c.completed_cards + new_cycles,
      available_rewards = c.available_rewards + new_cycles,
      updated_at = now()
    where id = target_customer_id returning * into row_data;

    insert into public.pilot_transactions(
      customer_id, kind, quantity, idempotency_key, resulting_progress,
      resulting_completed_cards, resulting_available_rewards
    ) values (
      target_customer_id, 'purchase', quantity, operation_key, row_data.current_progress,
      row_data.completed_cards, row_data.available_rewards
    );
  end if;

  return query select row_data.id, row_data.public_token, row_data.full_name,
    row_data.current_progress, row_data.completed_cards,
    row_data.available_rewards, row_data.redeemed_rewards;
end;
$$;

create or replace function public.pilot_redeem_reward(
  staff_code text,
  target_customer_id uuid,
  operation_key text
)
returns table (
  customer_id uuid,
  public_token uuid,
  full_name text,
  current_progress smallint,
  completed_cards integer,
  available_rewards integer,
  redeemed_rewards integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data public.pilot_customers%rowtype;
begin
  if not private.pilot_authorized(staff_code) then raise exception 'Acesso inválido'; end if;
  if operation_key is null or char_length(operation_key) < 12 then raise exception 'Operação inválida'; end if;

  if exists (select 1 from public.pilot_transactions where idempotency_key = operation_key) then
    select * into row_data from public.pilot_customers where id = target_customer_id;
  else
    select * into row_data from public.pilot_customers where id = target_customer_id for update;
    if not found then raise exception 'Cliente não encontrado'; end if;
    if row_data.available_rewards < 1 then raise exception 'Nenhum prêmio disponível'; end if;

    update public.pilot_customers c set
      available_rewards = c.available_rewards - 1,
      redeemed_rewards = c.redeemed_rewards + 1,
      updated_at = now()
    where id = target_customer_id returning * into row_data;

    insert into public.pilot_transactions(
      customer_id, kind, quantity, idempotency_key, resulting_progress,
      resulting_completed_cards, resulting_available_rewards
    ) values (
      target_customer_id, 'redeem', 0, operation_key, row_data.current_progress,
      row_data.completed_cards, row_data.available_rewards
    );
  end if;

  return query select row_data.id, row_data.public_token, row_data.full_name,
    row_data.current_progress, row_data.completed_cards,
    row_data.available_rewards, row_data.redeemed_rewards;
end;
$$;

create or replace function public.pilot_get_card(card_token uuid)
returns table (
  full_name text,
  current_progress smallint,
  completed_cards integer,
  available_rewards integer,
  redeemed_rewards integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.full_name, c.current_progress, c.completed_cards,
    c.available_rewards, c.redeemed_rewards, c.updated_at
  from public.pilot_customers c where c.public_token = card_token;
$$;

revoke all on function public.pilot_enroll_customer(text,text,text,text) from public;
revoke all on function public.pilot_search_customers(text,text) from public;
revoke all on function public.pilot_record_purchase(text,uuid,smallint,text) from public;
revoke all on function public.pilot_redeem_reward(text,uuid,text) from public;
revoke all on function public.pilot_get_card(uuid) from public;
grant execute on function public.pilot_enroll_customer(text,text,text,text) to anon, authenticated;
grant execute on function public.pilot_search_customers(text,text) to anon, authenticated;
grant execute on function public.pilot_record_purchase(text,uuid,smallint,text) to anon, authenticated;
grant execute on function public.pilot_redeem_reward(text,uuid,text) to anon, authenticated;
grant execute on function public.pilot_get_card(uuid) to anon, authenticated;