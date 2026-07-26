begin;

create or replace function private.capitalize_name_word(raw_word text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  source text := pg_catalog.lower(coalesce(raw_word, ''));
  result text := '';
  character text;
  position integer;
  capitalize_next boolean := true;
begin
  if source = '' then return ''; end if;
  for position in 1..pg_catalog.char_length(source) loop
    character := pg_catalog.substr(source, position, 1);
    if character in ('-', '''', '’') then
      result := result || character;
      capitalize_next := true;
    elsif capitalize_next then
      result := result || pg_catalog.upper(character);
      capitalize_next := false;
    else
      result := result || character;
    end if;
  end loop;
  return result;
end;
$$;

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
    pg_catalog.btrim(coalesce(raw_name, '')),
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
      else private.capitalize_name_word(current_word)
    end;
    normalized_words := pg_catalog.array_append(normalized_words, normalized_word);
  end loop;
  return pg_catalog.array_to_string(normalized_words, ' ');
end;
$$;

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

revoke all on function private.capitalize_name_word(text) from public, anon;
revoke all on function private.normalize_person_name(text) from public, anon;

commit;
