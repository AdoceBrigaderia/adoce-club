begin;

create table if not exists public.customer_wallet_passes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'google_wallet'
    check (provider in ('google_wallet')),
  object_suffix text not null,
  status text not null default 'prepared'
    check (status in ('prepared', 'active', 'revoked')),
  generation_count integer not null default 1
    check (generation_count > 0),
  first_prepared_at timestamptz not null default now(),
  last_prepared_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (profile_id, provider),
  unique (provider, object_suffix)
);

alter table public.customer_wallet_passes enable row level security;
revoke all on table public.customer_wallet_passes from public, anon, authenticated;

create index if not exists customer_wallet_passes_status_idx
  on public.customer_wallet_passes(provider, status, last_prepared_at desc);

create or replace function public.customer_prepare_google_wallet_pass()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  profile_row public.profiles%rowtype;
  main_track_id uuid;
  current_progress integer := 0;
  available_rewards integer := 0;
  object_suffix text;
  wallet_row public.customer_wallet_passes%rowtype;
begin
  if current_user_id is null then
    raise exception 'Sessao do Clube obrigatoria';
  end if;

  select * into profile_row
  from public.profiles profile
  where profile.id = current_user_id
  for share;

  if profile_row.id is null or not coalesce(profile_row.active, true) then
    raise exception 'Cadastro do Clube nao encontrado';
  end if;

  if coalesce(profile_row.account_status::text, 'active') <> 'active' then
    raise exception 'Este cadastro precisa de atendimento';
  end if;

  select track.id, track.current_progress
  into main_track_id, current_progress
  from public.account_memberships membership
  join public.loyalty_accounts account
    on account.id = membership.account_id
   and account.active
  join public.loyalty_tracks track
    on track.account_id = account.id
   and track.kind::text = 'main'
  where membership.profile_id = current_user_id
    and membership.active
  order by membership.is_primary desc, membership.created_at
  limit 1;

  if main_track_id is not null then
    select count(*)::integer
    into available_rewards
    from public.rewards reward
    where reward.track_id = main_track_id
      and reward.status::text = 'available';
  end if;

  object_suffix := 'customer_' || replace(current_user_id::text, '-', '');

  insert into public.customer_wallet_passes(
    profile_id,
    provider,
    object_suffix,
    status,
    metadata
  ) values (
    current_user_id,
    'google_wallet',
    object_suffix,
    'prepared',
    jsonb_build_object(
      'member_code', profile_row.member_code,
      'current_progress', coalesce(current_progress, 0),
      'available_rewards', coalesce(available_rewards, 0)
    )
  )
  on conflict (profile_id, provider) do update
  set object_suffix = excluded.object_suffix,
      status = case
        when public.customer_wallet_passes.status = 'revoked' then 'prepared'
        else public.customer_wallet_passes.status
      end,
      generation_count = public.customer_wallet_passes.generation_count + 1,
      last_prepared_at = now(),
      revoked_at = null,
      metadata = excluded.metadata
  returning * into wallet_row;

  insert into public.audit_events(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    current_user_id,
    'customer.google_wallet_pass_prepared',
    'customer_wallet_pass',
    wallet_row.id::text,
    jsonb_build_object(
      'provider', wallet_row.provider,
      'object_suffix', wallet_row.object_suffix,
      'generation_count', wallet_row.generation_count,
      'current_progress', coalesce(current_progress, 0),
      'available_rewards', coalesce(available_rewards, 0)
    )
  );

  return jsonb_build_object(
    'profile_id', profile_row.id,
    'full_name', profile_row.full_name,
    'member_code', coalesce(
      nullif(trim(profile_row.member_code), ''),
      'ADOCE-' || upper(substr(replace(profile_row.id::text, '-', ''), 1, 8))
    ),
    'current_progress', coalesce(current_progress, 0),
    'available_rewards', coalesce(available_rewards, 0),
    'object_suffix', wallet_row.object_suffix,
    'generation_count', wallet_row.generation_count,
    'prepared_at', wallet_row.last_prepared_at
  );
end;
$$;

revoke all on function public.customer_prepare_google_wallet_pass() from public, anon;
grant execute on function public.customer_prepare_google_wallet_pass() to authenticated;

commit;
