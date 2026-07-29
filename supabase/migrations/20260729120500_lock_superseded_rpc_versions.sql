begin;

-- Remove versões substituídas da superfície PostgREST do navegador. As rotas
-- atuais usam exclusivamente as versões transacionais v2/v6 pelo BFF.
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
        'staff_create_manual_sale_in_cash',
        'staff_record_cash_movement',
        'submit_instant_order_v5'
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

-- O corte é fail-closed: nenhuma versão antiga pode continuar executável por
-- sessões do navegador e todas as substituições exigidas pelo código atual
-- precisam existir, usar SECURITY DEFINER e aceitar o papel authenticated.
do $$
declare
  exposed_legacy text[];
  missing_current text[];
begin
  select array_agg(distinct p.proname order by p.proname)
  into exposed_legacy
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'staff_create_manual_sale_in_cash',
      'staff_record_cash_movement',
      'submit_instant_order_v5'
    )
    and (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  if coalesce(cardinality(exposed_legacy), 0) > 0 then
    raise exception 'Superseded RPC versions remain exposed to browser roles: %',
      exposed_legacy;
  end if;

  select array_agg(expected_name order by expected_name)
  into missing_current
  from unnest(array[
    'staff_create_manual_sale_in_cash_v2',
    'staff_record_cash_movement_v2',
    'submit_instant_order_v6'
  ]::text[]) expected_name
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = expected_name
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  );

  if coalesce(cardinality(missing_current), 0) > 0 then
    raise exception 'Current routed RPC versions are unavailable: %', missing_current;
  end if;
end;
$$;

commit;
