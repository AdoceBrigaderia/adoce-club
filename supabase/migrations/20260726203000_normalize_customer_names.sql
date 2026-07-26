begin;

create or replace function private.normalize_person_name(raw_name text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  cleaned text;
  words text[];
  current_word text;
  normalized_word text;
  normalized_words text[] := array[]::text[];
  word_index integer := 0;
begin
  cleaned := pg_catalog.regexp_replace(
    pg_catalog.btrim(pg_catalog.coalesce(raw_name, '')),
    '\s+',
    ' ',
    'g'
  );
  if cleaned = '' then return ''; end if;

  words := pg_catalog.regexp_split_to_array(pg_catalog.lower(cleaned), '\s+');
  foreach current_word in array words loop
    word_index := word_index + 1;
    normalized_word := case
      when current_word in ('ii','iii','iv','v','vi','vii','viii','ix','x')
        then pg_catalog.upper(current_word)
      when word_index > 1 and current_word in ('da','das','de','do','dos','e')
        then current_word
      else pg_catalog.initcap(current_word)
    end;
    normalized_words := pg_catalog.array_append(normalized_words, normalized_word);
  end loop;

  return pg_catalog.array_to_string(normalized_words, ' ');
end;
$$;

create table if not exists public.customer_name_normalization_audit (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  previous_name text not null,
  normalized_name text not null,
  batch_id uuid not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  unique(profile_id, batch_id)
);

alter table public.customer_name_normalization_audit enable row level security;
drop policy if exists customer_name_normalization_audit_manager_read
  on public.customer_name_normalization_audit;
create policy customer_name_normalization_audit_manager_read
  on public.customer_name_normalization_audit
  for select
  to authenticated
  using (private.is_manager());

grant select on public.customer_name_normalization_audit to authenticated;
revoke insert, update, delete, truncate on public.customer_name_normalization_audit
  from public, anon, authenticated;

create or replace function private.normalize_profile_full_name()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.full_name := private.normalize_person_name(new.full_name);
  return new;
end;
$$;

drop trigger if exists profiles_normalize_full_name on public.profiles;
create trigger profiles_normalize_full_name
before insert or update of full_name on public.profiles
for each row execute function private.normalize_profile_full_name();

do $$
declare
  normalization_batch uuid := extensions.gen_random_uuid();
begin
  insert into public.customer_name_normalization_audit(
    profile_id,
    previous_name,
    normalized_name,
    batch_id
  )
  select
    profile.id,
    profile.full_name,
    private.normalize_person_name(profile.full_name),
    normalization_batch
  from public.profiles profile
  where profile.full_name is not null
    and private.normalize_person_name(profile.full_name) <> profile.full_name;

  update public.profiles profile
  set full_name = private.normalize_person_name(profile.full_name),
      updated_at = now()
  where profile.full_name is not null
    and private.normalize_person_name(profile.full_name) <> profile.full_name;
end;
$$;

revoke all on function private.normalize_person_name(text) from public, anon;
revoke all on function private.normalize_profile_full_name() from public, anon;

commit;
