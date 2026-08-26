alter table public.profiles
  add column member_code text;

create table private.member_code_counters (
  joined_year integer primary key check (joined_year between 2000 and 9999),
  last_value bigint not null check (last_value between 0 and 99999999)
);

revoke all on table private.member_code_counters from public, anon, authenticated;

create or replace function private.format_member_code(joined_year integer, sequence_value bigint)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  sequence_digits text;
begin
  if joined_year not between 2000 and 9999
    or sequence_value not between 1 and 99999999 then
    raise exception 'Invalid member code components';
  end if;

  sequence_digits := lpad(sequence_value::text, 8, '0');
  return 'ADOC ' || joined_year::text || ' '
    || substr(sequence_digits, 1, 4) || ' '
    || substr(sequence_digits, 5, 4);
end;
$$;

create or replace function private.next_member_code(joined_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  joined_year integer;
  sequence_value bigint;
begin
  joined_year := extract(year from joined_at at time zone 'America/Fortaleza')::integer;

  insert into private.member_code_counters(joined_year, last_value)
  values (joined_year, 1)
  on conflict (joined_year) do update
    set last_value = private.member_code_counters.last_value + 1
  returning last_value into sequence_value;

  return private.format_member_code(joined_year, sequence_value);
end;
$$;

revoke all on function private.format_member_code(integer, bigint) from public, anon, authenticated;
revoke all on function private.next_member_code(timestamptz) from public, anon, authenticated;

with numbered_profiles as (
  select
    id,
    extract(year from created_at at time zone 'America/Fortaleza')::integer as joined_year,
    row_number() over (
      partition by extract(year from created_at at time zone 'America/Fortaleza')
      order by created_at, id
    )::bigint as sequence_value
  from public.profiles
)
update public.profiles profile
set member_code = private.format_member_code(
  numbered_profiles.joined_year,
  numbered_profiles.sequence_value
)
from numbered_profiles
where numbered_profiles.id = profile.id;

insert into private.member_code_counters(joined_year, last_value)
select
  extract(year from created_at at time zone 'America/Fortaleza')::integer,
  count(*)::bigint
from public.profiles
group by 1
on conflict (joined_year) do update
  set last_value = excluded.last_value;

alter table public.profiles
  alter column member_code set not null,
  add constraint profiles_member_code_format_check
    check (member_code ~ '^ADOC [0-9]{4} [0-9]{4} [0-9]{4}$'),
  add constraint profiles_member_code_unique unique (member_code);

create or replace function private.assign_member_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.member_code is null then
    new.member_code := private.next_member_code(coalesce(new.created_at, now()));
  end if;
  return new;
end;
$$;

create or replace function private.preserve_member_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.member_code is distinct from old.member_code then
    raise exception 'O Código do Membro não pode ser alterado.';
  end if;
  return new;
end;
$$;

revoke all on function private.assign_member_code() from public, anon, authenticated;
revoke all on function private.preserve_member_code() from public, anon, authenticated;

create trigger profiles_assign_member_code
before insert on public.profiles
for each row execute function private.assign_member_code();

create trigger profiles_preserve_member_code
before update of member_code on public.profiles
for each row execute function private.preserve_member_code();

create or replace function public.record_owner_production_rollback(
  rollback_status text,
  safe_deploy_id text,
  restored_deploy_id text default null,
  failure_message text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_id bigint;
begin
  if not exists (
    select 1
    from public.staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.active
      and staff.role = 'owner'
  ) then
    raise exception 'Apenas o proprietário pode registrar uma restauração de produção.';
  end if;

  if rollback_status not in ('requested', 'completed', 'failed') then
    raise exception 'Status de restauração inválido.';
  end if;

  insert into public.audit_events(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    (select auth.uid()),
    'production_rollback_' || rollback_status,
    'netlify_deploy',
    coalesce(restored_deploy_id, safe_deploy_id),
    jsonb_build_object(
      'safe_deploy_id', safe_deploy_id,
      'restored_deploy_id', restored_deploy_id,
      'failure_message', failure_message
    )
  ) returning id into audit_id;

  return audit_id;
end;
$$;

revoke all on function public.record_owner_production_rollback(text, text, text, text)
  from public, anon;
grant execute on function public.record_owner_production_rollback(text, text, text, text)
  to authenticated;
