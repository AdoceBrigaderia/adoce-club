\set ON_ERROR_STOP on

begin;

do $$
declare
  required_tables text[] := array[
    'stores',
    'cash_registers',
    'staff_store_assignments',
    'cash_sessions',
    'cash_movements'
  ];
  missing_tables text[];
  rls_disabled text[];
  anonymous_privileges text[];
  authenticated_write_privileges text[];
  anonymous_policies text[];
  missing_read_policies text[];
  weak_read_policies text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(required_tables) table_name
  where to_regclass(format('public.%I', table_name)) is null;

  if coalesce(cardinality(missing_tables), 0) > 0 then
    raise exception 'Store-scoped tables missing from the RLS boundary: %', missing_tables;
  end if;

  select array_agg(class.relname order by class.relname)
  into rls_disabled
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any(required_tables)
    and class.relkind in ('r', 'p')
    and not class.relrowsecurity;

  if coalesce(cardinality(rls_disabled), 0) > 0 then
    raise exception 'RLS disabled on store-scoped tables: %', rls_disabled;
  end if;

  select array_agg(class.relname order by class.relname)
  into anonymous_privileges
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any(required_tables)
    and (
      has_table_privilege('anon', format('%I.%I', namespace.nspname, class.relname), 'SELECT')
      or has_table_privilege('anon', format('%I.%I', namespace.nspname, class.relname), 'INSERT')
      or has_table_privilege('anon', format('%I.%I', namespace.nspname, class.relname), 'UPDATE')
      or has_table_privilege('anon', format('%I.%I', namespace.nspname, class.relname), 'DELETE')
    );

  if coalesce(cardinality(anonymous_privileges), 0) > 0 then
    raise exception 'Anonymous table privileges found inside the store boundary: %',
      anonymous_privileges;
  end if;

  select array_agg(class.relname order by class.relname)
  into authenticated_write_privileges
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any(required_tables)
    and (
      has_table_privilege('authenticated', format('%I.%I', namespace.nspname, class.relname), 'INSERT')
      or has_table_privilege('authenticated', format('%I.%I', namespace.nspname, class.relname), 'UPDATE')
      or has_table_privilege('authenticated', format('%I.%I', namespace.nspname, class.relname), 'DELETE')
      or has_table_privilege('authenticated', format('%I.%I', namespace.nspname, class.relname), 'TRUNCATE')
    );

  if coalesce(cardinality(authenticated_write_privileges), 0) > 0 then
    raise exception 'Direct authenticated writes bypass the RPC boundary on: %',
      authenticated_write_privileges;
  end if;

  select array_agg(format('%s:%s:%s', policy.tablename, policy.policyname, role_name)
    order by policy.tablename, policy.policyname, role_name)
  into anonymous_policies
  from pg_policies policy
  cross join lateral unnest(policy.roles) expanded_role(role_name)
  where policy.schemaname = 'public'
    and policy.tablename = any(required_tables)
    and role_name::text in ('anon', 'public');

  if coalesce(cardinality(anonymous_policies), 0) > 0 then
    raise exception 'Anonymous RLS policies found inside the store boundary: %',
      anonymous_policies;
  end if;

  select array_agg(table_name order by table_name)
  into missing_read_policies
  from unnest(required_tables) table_name
  where not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = table_name
      and lower(policy.cmd) = 'select'
      and 'authenticated'::name = any(policy.roles)
  );

  if coalesce(cardinality(missing_read_policies), 0) > 0 then
    raise exception 'Authenticated read policies missing from store-scoped tables: %',
      missing_read_policies;
  end if;

  select array_agg(format('%s:%s', policy.tablename, policy.policyname)
    order by policy.tablename, policy.policyname)
  into weak_read_policies
  from pg_policies policy
  where policy.schemaname = 'public'
    and lower(policy.cmd) = 'select'
    and 'authenticated'::name = any(policy.roles)
    and policy.tablename = any(required_tables)
    and case policy.tablename
      when 'stores' then position('private.can_access_store(id)' in lower(coalesce(policy.qual, ''))) = 0
      when 'cash_registers' then position('private.can_access_store(store_id)' in lower(coalesce(policy.qual, ''))) = 0
      when 'cash_sessions' then position('private.can_access_store(store_id)' in lower(coalesce(policy.qual, ''))) = 0
      when 'cash_movements' then position('private.can_access_store(store_id)' in lower(coalesce(policy.qual, ''))) = 0
      when 'staff_store_assignments' then
        position('private.is_manager()' in lower(coalesce(policy.qual, ''))) = 0
        or position('auth.uid()' in lower(coalesce(policy.qual, ''))) = 0
      else true
    end;

  if coalesce(cardinality(weak_read_policies), 0) > 0 then
    raise exception 'Store isolation predicates missing from read policies: %',
      weak_read_policies;
  end if;
end;
$$;

rollback;
