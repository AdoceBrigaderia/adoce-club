begin;

-- These RPCs belonged to browser-direct or remote administrative flows that
-- have been replaced by same-origin BFF Functions. Preserve the database
-- objects for audit/rollback history, but make them unreachable from browser
-- roles. Server-side service_role remains able to use them during controlled
-- maintenance if necessary.
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
      and p.proname in (
        'get_instant_order',
        'begin_whatsapp_verification',
        'customer_claim_verified_whatsapp_registration',
        'record_owner_production_rollback'
      )
  loop
    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated',
      routine.schema_name,
      routine.function_name,
      routine.identity_arguments
    );
    execute format(
      'grant execute on function %I.%I(%s) to service_role',
      routine.schema_name,
      routine.function_name,
      routine.identity_arguments
    );
  end loop;
end;
$$;

-- Regression guard: no retired RPC may remain reachable through PostgREST by
-- an anonymous or signed-in browser session.
do $$
declare
  exposed record;
begin
  select
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments
  into exposed
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'get_instant_order',
      'begin_whatsapp_verification',
      'customer_claim_verified_whatsapp_registration',
      'record_owner_production_rollback'
    )
    and (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )
  limit 1;

  if exposed.function_name is not null then
    raise exception 'Retired RPC %.%(%) remains exposed to browser roles',
      'public', exposed.function_name, exposed.identity_arguments;
  end if;
end;
$$;

commit;
