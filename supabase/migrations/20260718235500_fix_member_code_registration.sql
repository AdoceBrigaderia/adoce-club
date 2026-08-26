create or replace function private.next_member_code(joined_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_joined_year integer;
  sequence_value bigint;
begin
  member_joined_year := extract(
    year from joined_at at time zone 'America/Fortaleza'
  )::integer;

  insert into private.member_code_counters(joined_year, last_value)
  values (member_joined_year, 1)
  on conflict on constraint member_code_counters_pkey do update
    set last_value = private.member_code_counters.last_value + 1
  returning last_value into sequence_value;

  return private.format_member_code(member_joined_year, sequence_value);
end;
$$;

revoke all on function private.next_member_code(timestamptz)
  from public, anon, authenticated;
