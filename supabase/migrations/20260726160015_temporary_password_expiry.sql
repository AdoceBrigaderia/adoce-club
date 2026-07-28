begin;

alter table public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists temporary_password_issued_at timestamptz,
  add column if not exists temporary_password_expires_at timestamptz;

alter table public.staff_members
  add column if not exists must_change_password boolean not null default false,
  add column if not exists temporary_password_issued_at timestamptz,
  add column if not exists temporary_password_expires_at timestamptz;

update public.profiles
set temporary_password_issued_at = coalesce(temporary_password_issued_at, now()),
    temporary_password_expires_at = coalesce(temporary_password_expires_at, now() + interval '2 hours')
where must_change_password
  and temporary_password_expires_at is null;

update public.staff_members
set temporary_password_issued_at = coalesce(temporary_password_issued_at, now()),
    temporary_password_expires_at = coalesce(temporary_password_expires_at, now() + interval '2 hours')
where must_change_password
  and temporary_password_expires_at is null;

alter table public.profiles
  drop constraint if exists profiles_temporary_password_window_check;
alter table public.profiles
  add constraint profiles_temporary_password_window_check check (
    temporary_password_expires_at is null
    or (
      must_change_password
      and temporary_password_issued_at is not null
      and temporary_password_expires_at > temporary_password_issued_at
    )
  );

alter table public.staff_members
  drop constraint if exists staff_members_temporary_password_window_check;
alter table public.staff_members
  add constraint staff_members_temporary_password_window_check check (
    temporary_password_expires_at is null
    or (
      must_change_password
      and temporary_password_issued_at is not null
      and temporary_password_expires_at > temporary_password_issued_at
    )
  );

create index if not exists profiles_temporary_password_expires_idx
  on public.profiles(temporary_password_expires_at)
  where must_change_password;
create index if not exists staff_members_temporary_password_expires_idx
  on public.staff_members(temporary_password_expires_at)
  where must_change_password;

create or replace function public.complete_forced_password_change()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  profile_changed boolean := false;
  staff_changed boolean := false;
begin
  if current_user_id is null then
    raise exception 'Acesso nao autorizado';
  end if;

  update public.profiles
  set must_change_password = false,
      temporary_password_issued_at = null,
      temporary_password_expires_at = null,
      updated_at = now()
  where id = current_user_id
  returning true into profile_changed;

  update public.staff_members
  set must_change_password = false,
      temporary_password_issued_at = null,
      temporary_password_expires_at = null
  where user_id = current_user_id
  returning true into staff_changed;

  if not coalesce(profile_changed, false) then
    raise exception 'Perfil nao encontrado';
  end if;

  insert into public.audit_events(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    current_user_id,
    'security.forced_password_change_completed',
    case when coalesce(staff_changed, false) then 'staff' else 'customer' end,
    current_user_id::text,
    jsonb_build_object(
      'temporary_password_cleared', true,
      'completed_at', now()
    )
  );

  return jsonb_build_object(
    'completed', true,
    'staff', coalesce(staff_changed, false)
  );
end;
$$;

revoke all on function public.complete_forced_password_change() from public, anon;
grant execute on function public.complete_forced_password_change() to authenticated;

commit;
