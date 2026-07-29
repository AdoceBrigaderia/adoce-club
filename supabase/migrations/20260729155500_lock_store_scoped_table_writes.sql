begin;

revoke insert, update, delete, truncate on table
  public.stores,
  public.cash_registers,
  public.staff_store_assignments,
  public.cash_sessions,
  public.cash_movements,
  public.customer_checkins,
  public.cash_reconciliation_queue
from public, anon, authenticated;

revoke all on table
  public.customer_checkins,
  public.cash_reconciliation_queue
from public, anon, authenticated;

drop policy if exists stores_manager_insert on public.stores;
drop policy if exists stores_manager_update on public.stores;
drop policy if exists cash_registers_manager_insert on public.cash_registers;
drop policy if exists cash_registers_manager_update on public.cash_registers;
drop policy if exists staff_store_assignments_manager_all on public.staff_store_assignments;

-- Uma migration anterior documentava o deny-all com uma policy explícita.
-- A fronteira canônica RPC-only usa ausência total de policies do navegador,
-- mantendo RLS habilitado e todos os privilégios revogados.
drop policy if exists backend_only_no_direct_access on public.customer_checkins;
drop policy if exists backend_only_no_direct_access on public.cash_reconciliation_queue;

do $$
declare
  locked_tables text[] := array[
    'stores',
    'cash_registers',
    'staff_store_assignments',
    'cash_sessions',
    'cash_movements',
    'customer_checkins',
    'cash_reconciliation_queue'
  ];
  rpc_only_tables text[] := array[
    'customer_checkins',
    'cash_reconciliation_queue'
  ];
  exposed_write_privileges text[];
  browser_write_policies text[];
  rpc_only_browser_privileges text[];
  rpc_only_browser_policies text[];
begin
  select array_agg(format('%s:%s', class.relname, role_name)
    order by class.relname, role_name)
  into exposed_write_privileges
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  cross join lateral unnest(array['anon', 'authenticated']) role_name
  where namespace.nspname = 'public'
    and class.relname = any(locked_tables)
    and (
      has_table_privilege(role_name::name, format('%I.%I', namespace.nspname, class.relname), 'INSERT')
      or has_table_privilege(role_name::name, format('%I.%I', namespace.nspname, class.relname), 'UPDATE')
      or has_table_privilege(role_name::name, format('%I.%I', namespace.nspname, class.relname), 'DELETE')
      or has_table_privilege(role_name::name, format('%I.%I', namespace.nspname, class.relname), 'TRUNCATE')
    );

  if coalesce(cardinality(exposed_write_privileges), 0) > 0 then
    raise exception 'Store-scoped tables still expose direct browser writes: %',
      exposed_write_privileges;
  end if;

  select array_agg(format('%s:%s:%s', policy.tablename, policy.policyname, role_name)
    order by policy.tablename, policy.policyname, role_name)
  into browser_write_policies
  from pg_policies policy
  cross join lateral unnest(policy.roles) expanded_role(role_name)
  where policy.schemaname = 'public'
    and policy.tablename = any(locked_tables)
    and role_name::text in ('public', 'anon', 'authenticated')
    and lower(policy.cmd) in ('all', 'insert', 'update', 'delete');

  if coalesce(cardinality(browser_write_policies), 0) > 0 then
    raise exception 'Store-scoped browser write policies remain after lockdown: %',
      browser_write_policies;
  end if;

  select array_agg(format('%s:%s', class.relname, role_name)
    order by class.relname, role_name)
  into rpc_only_browser_privileges
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  cross join lateral unnest(array['anon', 'authenticated']) role_name
  where namespace.nspname = 'public'
    and class.relname = any(rpc_only_tables)
    and (
      has_table_privilege(role_name::name, format('%I.%I', namespace.nspname, class.relname), 'SELECT')
      or has_table_privilege(role_name::name, format('%I.%I', namespace.nspname, class.relname), 'INSERT')
      or has_table_privilege(role_name::name, format('%I.%I', namespace.nspname, class.relname), 'UPDATE')
      or has_table_privilege(role_name::name, format('%I.%I', namespace.nspname, class.relname), 'DELETE')
      or has_table_privilege(role_name::name, format('%I.%I', namespace.nspname, class.relname), 'TRUNCATE')
    );

  if coalesce(cardinality(rpc_only_browser_privileges), 0) > 0 then
    raise exception 'RPC-only store tables still expose browser privileges: %',
      rpc_only_browser_privileges;
  end if;

  select array_agg(format('%s:%s:%s', policy.tablename, policy.policyname, role_name)
    order by policy.tablename, policy.policyname, role_name)
  into rpc_only_browser_policies
  from pg_policies policy
  cross join lateral unnest(policy.roles) expanded_role(role_name)
  where policy.schemaname = 'public'
    and policy.tablename = any(rpc_only_tables)
    and role_name::text in ('public', 'anon', 'authenticated');

  if coalesce(cardinality(rpc_only_browser_policies), 0) > 0 then
    raise exception 'RPC-only store tables still expose browser policies: %',
      rpc_only_browser_policies;
  end if;
end;
$$;

commit;
