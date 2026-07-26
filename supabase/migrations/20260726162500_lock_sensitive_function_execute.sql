begin;

-- SECURITY DEFINER functions are executable by PUBLIC by default. The
-- operational API must never inherit that default: only explicitly granted
-- roles may invoke staff, manager and owner routines.
do $$
declare
  routine record;
begin
  for routine in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname ~ '^(staff_|manager_|owner_|record_owner_)'
  loop
    execute format(
      'revoke all on function %I.%I(%s) from public, anon',
      routine.schema_name,
      routine.function_name,
      routine.identity_arguments
    );
  end loop;
end;
$$;

-- The pilot RPC surface belonged to the retired local prototype. Keep the
-- historical database objects for rollback/audit, but make them unreachable
-- from both public and signed-in browser clients.
do $$
declare
  routine record;
begin
  for routine in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname ~ '^pilot_'
  loop
    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated',
      routine.schema_name,
      routine.function_name,
      routine.identity_arguments
    );
  end loop;
end;
$$;

-- Regression guard: abort the migration if a sensitive SECURITY DEFINER RPC
-- remains callable anonymously. Passing the function OID avoids ambiguity
-- caused by named arguments in pg_get_function_identity_arguments().
do $$
declare
  exposed_count integer;
begin
  select count(*)
  into exposed_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.proname ~ '^(staff_|manager_|owner_|record_owner_)'
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if exposed_count <> 0 then
    raise exception '% sensitive functions remain executable by anon', exposed_count;
  end if;
end;
$$;

commit;
