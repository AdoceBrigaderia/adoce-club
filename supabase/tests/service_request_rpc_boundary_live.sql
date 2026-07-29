\set ON_ERROR_STOP on

begin;

do $$
declare
  required_service_request_tables text[] := array[
    'service_requests',
    'service_request_cake_builds',
    'service_request_product_configurations',
    'service_request_pricing_snapshots'
  ];
  child_service_request_tables text[] := array[
    'service_request_cake_builds',
    'service_request_product_configurations',
    'service_request_pricing_snapshots'
  ];
  missing_tables text[];
  rls_disabled text[];
  browser_privileges text[];
  browser_policies text[];
  missing_parent_fks text[];
  workspace_routine regprocedure;
  workspace_definition text;
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(required_service_request_tables) table_name
  where to_regclass(format('public.%I', table_name)) is null;

  if coalesce(cardinality(missing_tables), 0) > 0 then
    raise exception 'Service-request RPC-only tables are missing: %', missing_tables;
  end if;

  select array_agg(class.relname order by class.relname)
  into rls_disabled
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any(required_service_request_tables)
    and class.relkind in ('r', 'p')
    and not class.relrowsecurity;

  if coalesce(cardinality(rls_disabled), 0) > 0 then
    raise exception 'RLS disabled on service-request RPC-only tables: %', rls_disabled;
  end if;

  select array_agg(
    format('%s:%s:%s', class.relname, role_name, privilege_name)
    order by class.relname, role_name, privilege_name
  )
  into browser_privileges
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  cross join lateral unnest(array['anon', 'authenticated']) role_name
  cross join lateral unnest(array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ]) privilege_name
  where namespace.nspname = 'public'
    and class.relname = any(required_service_request_tables)
    and has_table_privilege(
      role_name::name,
      format('%I.%I', namespace.nspname, class.relname),
      privilege_name
    );

  if coalesce(cardinality(browser_privileges), 0) > 0 then
    raise exception 'Service-request RPC-only tables expose browser privileges: %',
      browser_privileges;
  end if;

  select array_agg(
    format('%s:%s:%s', policy.tablename, policy.policyname, role_name)
    order by policy.tablename, policy.policyname, role_name
  )
  into browser_policies
  from pg_policies policy
  cross join lateral unnest(policy.roles) expanded_role(role_name)
  where policy.schemaname = 'public'
    and policy.tablename = any(required_service_request_tables)
    and role_name::text in ('public', 'anon', 'authenticated');

  if coalesce(cardinality(browser_policies), 0) > 0 then
    raise exception 'Service-request RPC-only tables expose browser policies: %',
      browser_policies;
  end if;

  if not exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'service_requests'
      and column_info.column_name = 'store_id'
      and column_info.data_type = 'uuid'
  ) then
    raise exception 'service_requests.store_id is missing from the operational scope';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_info
    join pg_class child_table on child_table.oid = constraint_info.conrelid
    join pg_namespace child_namespace on child_namespace.oid = child_table.relnamespace
    join pg_class parent_table on parent_table.oid = constraint_info.confrelid
    join pg_namespace parent_namespace on parent_namespace.oid = parent_table.relnamespace
    join lateral unnest(constraint_info.conkey) with ordinality child_key(attnum, position)
      on true
    join pg_attribute child_column
      on child_column.attrelid = child_table.oid
     and child_column.attnum = child_key.attnum
    where constraint_info.contype = 'f'
      and child_namespace.nspname = 'public'
      and child_table.relname = 'service_requests'
      and child_column.attname = 'store_id'
      and parent_namespace.nspname = 'public'
      and parent_table.relname = 'stores'
  ) then
    raise exception 'service_requests.store_id lost its store foreign key';
  end if;

  select array_agg(child_name order by child_name)
  into missing_parent_fks
  from unnest(child_service_request_tables) child_name
  where not exists (
    select 1
    from pg_constraint constraint_info
    join pg_class child_table on child_table.oid = constraint_info.conrelid
    join pg_namespace child_namespace on child_namespace.oid = child_table.relnamespace
    join pg_class parent_table on parent_table.oid = constraint_info.confrelid
    join pg_namespace parent_namespace on parent_namespace.oid = parent_table.relnamespace
    join lateral unnest(constraint_info.conkey) with ordinality child_key(attnum, position)
      on true
    join pg_attribute child_column
      on child_column.attrelid = child_table.oid
     and child_column.attnum = child_key.attnum
    where constraint_info.contype = 'f'
      and child_namespace.nspname = 'public'
      and child_table.relname = child_name
      and child_column.attname = 'request_id'
      and parent_namespace.nspname = 'public'
      and parent_table.relname = 'service_requests'
  );

  if coalesce(cardinality(missing_parent_fks), 0) > 0 then
    raise exception 'Service-request child tables lost request_id parent foreign keys: %',
      missing_parent_fks;
  end if;

  if to_regprocedure(
    'public.submit_service_request_bff(uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid,uuid)'
  ) is null then
    raise exception 'submit_service_request_bff lost the store-scoped signature';
  end if;

  workspace_routine := to_regprocedure(
    'public.staff_get_service_request_workspace(text,text,integer,uuid)'
  );
  if workspace_routine is null then
    raise exception 'staff_get_service_request_workspace lost the store filter signature';
  end if;

  if to_regprocedure('public.staff_get_service_request_workspace(text,text,integer)') is not null then
    raise exception 'staff_get_service_request_workspace restored the unscoped public signature';
  end if;

  select pg_get_functiondef(workspace_routine::oid) into workspace_definition;

  if position('staff_get_service_request_workspace_unscoped_internal' in workspace_definition) > 0 then
    raise exception 'staff_get_service_request_workspace still scans the unscoped implementation';
  end if;

  if position('private.staff_has_capability(request.store_id, ''manage_orders'')' in workspace_definition) = 0
     or position('target_store_id is null or request.store_id = target_store_id' in workspace_definition) = 0 then
    raise exception 'staff_get_service_request_workspace lost row-level store authorization';
  end if;

  if position('private.staff_has_capability(request.store_id, ''view_finance'')' in workspace_definition) = 0 then
    raise exception 'staff_get_service_request_workspace lost the financial capability ceiling';
  end if;
end;
$$;

rollback;
