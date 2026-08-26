-- Harden customer identity without deleting or rewriting loyalty history.
-- Destructive account deletion stays server-only and requires a separately
-- reviewed retention/anonymisation workflow.

alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'deactivated', 'pending_deletion', 'merged')),
  add column if not exists auth_upgraded_at timestamptz,
  add column if not exists merged_into_profile_id uuid references public.profiles(id),
  add column if not exists status_reason_code text,
  add column if not exists status_reason_note text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references public.staff_members(user_id);

alter table public.profiles
  drop constraint if exists profiles_merged_target_check;
alter table public.profiles
  add constraint profiles_merged_target_check
  check (merged_into_profile_id is null or merged_into_profile_id <> id);

create index if not exists profiles_account_status_idx
  on public.profiles(account_status, updated_at desc);

create table if not exists public.customer_account_actions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  actor_user_id uuid not null references public.staff_members(user_id),
  action text not null check (action in (
    'deactivate', 'reactivate', 'request_deletion', 'mark_duplicate', 'cancel_deletion'
  )),
  reason_code text not null check (reason_code in (
    'duplicate_registration', 'customer_request', 'created_by_mistake',
    'security_review', 'terms_violation', 'legal_requirement', 'other'
  )),
  reason_note text,
  previous_status text not null,
  resulting_status text not null,
  notification_email text,
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'not_applicable', 'failed')),
  notification_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists customer_account_actions_profile_idx
  on public.customer_account_actions(profile_id, created_at desc);

alter table public.customer_account_actions enable row level security;

drop policy if exists customer_account_actions_manager_read
  on public.customer_account_actions;
create policy customer_account_actions_manager_read
  on public.customer_account_actions for select
  to authenticated
  using ((select private.is_manager()));

revoke all on public.customer_account_actions from anon, authenticated;
grant select on public.customer_account_actions to authenticated;
grant all on public.customer_account_actions to service_role;

create or replace function private.is_active_profile()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.active
      and profile.account_status = 'active'
  );
$$;

revoke all on function private.is_active_profile() from public, anon;
grant execute on function private.is_active_profile() to authenticated;

create or replace function private.is_account_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_active_profile()) and exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = target_account_id
      and membership.profile_id = (select auth.uid())
      and membership.active
  );
$$;

revoke all on function private.is_account_member(uuid) from public, anon;
grant execute on function private.is_account_member(uuid) to authenticated;

create or replace function public.customer_security_status()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'account_status', profile.account_status,
    'auth_upgraded', profile.auth_upgraded_at is not null,
    'phone_verified', profile.whatsapp_verified_at is not null,
    'phone_e164', profile.phone_e164
  )
  from public.profiles profile
  where profile.id = (select auth.uid());
$$;

revoke all on function public.customer_security_status() from public, anon;
grant execute on function public.customer_security_status() to authenticated;

create or replace function public.staff_duplicate_customer_candidates()
returns table(
  profile_id uuid,
  full_name text,
  email text,
  phone_e164 text,
  member_code text,
  created_at timestamptz,
  possible_duplicate_of uuid,
  match_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_manager()) then
    raise exception 'Acesso restrito a gerentes e proprietarios';
  end if;

  return query
  select
    candidate.id,
    candidate.full_name,
    candidate.email,
    candidate.phone_e164,
    candidate.member_code,
    candidate.created_at,
    original.id,
    case
      when candidate.phone_e164 is not null and candidate.phone_e164 = original.phone_e164
        then 'Mesmo telefone'
      when candidate.email is not null and lower(candidate.email) = lower(original.email)
        then 'Mesmo e-mail'
      else 'Mesmo nome e contato incompleto'
    end
  from public.profiles candidate
  join public.profiles original on original.id < candidate.id
  where candidate.account_status = 'active'
    and original.account_status = 'active'
    and (
      (candidate.phone_e164 is not null and candidate.phone_e164 = original.phone_e164)
      or (candidate.email is not null and lower(candidate.email) = lower(original.email))
      or (
        candidate.phone_e164 is null and original.phone_e164 is null
        and lower(trim(candidate.full_name)) = lower(trim(original.full_name))
      )
    );
end;
$$;

revoke all on function public.staff_duplicate_customer_candidates()
  from public, anon, authenticated;
grant execute on function public.staff_duplicate_customer_candidates()
  to authenticated;

-- Never allow a deactivated, pending-deletion or merged profile to start a
-- referral. Existing referral protections remain in force as well.
create or replace function private.assert_customer_account_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = new.referrer_profile_id
      and profile.active and profile.account_status = 'active'
  ) or not exists (
    select 1 from public.profiles profile
    where profile.id = new.referred_profile_id
      and profile.active and profile.account_status = 'active'
  ) then
    raise exception 'A indicacao exige dois cadastros ativos';
  end if;
  return new;
end;
$$;

revoke all on function private.assert_customer_account_active()
  from public, anon, authenticated;
drop trigger if exists referrals_require_active_customers on public.referrals;
create trigger referrals_require_active_customers
before insert or update of status on public.referrals
for each row execute function private.assert_customer_account_active();
