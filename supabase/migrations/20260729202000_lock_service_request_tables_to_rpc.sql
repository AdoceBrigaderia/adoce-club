begin;

-- Dados pessoais, configurações e snapshots financeiros ficam exclusivamente
-- atrás de RPCs/BFF. A raiz recebe escopo de loja; filhas herdam por request_id.
alter table public.service_requests
  add column if not exists store_id uuid references public.stores(id) on delete restrict;

create index if not exists service_requests_store_status_start_idx
  on public.service_requests(store_id, status, desired_start, created_at desc);

do $$
declare
  active_store_count integer;
  only_active_store uuid;
  backfilled_count integer := 0;
begin
  select count(*) into active_store_count from public.stores store where store.active;
  if active_store_count = 1 then
    select store.id into only_active_store
    from public.stores store
    where store.active
    order by store.created_at, store.id
    limit 1;

    update public.service_requests
    set store_id = only_active_store
    where store_id is null;
    get diagnostics backfilled_count = row_count;
    raise notice 'service_requests store scope backfill: store=%, updated=%',
      only_active_store, backfilled_count;
  else
    raise notice 'service_requests store scope backfill skipped: active_store_count=%',
      active_store_count;
  end if;
end;
$$;

alter table public.service_requests enable row level security;
alter table public.service_request_cake_builds enable row level security;
alter table public.service_request_product_configurations enable row level security;
alter table public.service_request_pricing_snapshots enable row level security;

revoke all on table
  public.service_requests,
  public.service_request_cake_builds,
  public.service_request_product_configurations,
  public.service_request_pricing_snapshots
from public, anon, authenticated;

do $$
declare
  policy_row record;
  locked_service_request_tables text[] := array[
    'service_requests',
    'service_request_cake_builds',
    'service_request_product_configurations',
    'service_request_pricing_snapshots'
  ];
begin
  for policy_row in
    select policy.tablename, policy.policyname
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = any(locked_service_request_tables)
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  end loop;
end;
$$;

grant all on table
  public.service_requests,
  public.service_request_cake_builds,
  public.service_request_product_configurations,
  public.service_request_pricing_snapshots
to service_role;

-- A implementação consolidada anterior continua responsável por validar e
-- calcular a encomenda. Ela deixa de ser chamável e passa a ser encapsulada.
alter function public.submit_service_request_bff(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid
) rename to submit_service_request_bff_unscoped_internal;

revoke all on function public.submit_service_request_bff_unscoped_internal(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid
) from public, anon, authenticated;
grant execute on function public.submit_service_request_bff_unscoped_internal(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid
) to service_role;

create function public.submit_service_request_bff(
  requested_operation_key uuid,
  requested_product_id uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_customer_email text,
  requested_quantity integer,
  requested_start timestamptz,
  requested_end timestamptz,
  requested_location text default '',
  requested_selections jsonb default '{}'::jsonb,
  requested_notes text default '',
  requested_profile_id uuid default null,
  requested_store_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  response jsonb;
  resolved_store_id uuid;
  target_request_id uuid;
  active_store_count integer;
begin
  if requested_operation_key is null then
    raise exception 'Chave da solicitação é obrigatória';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('public-service-request:' || requested_operation_key::text, 0)
  );

  if requested_store_id is not null then
    select store.id into resolved_store_id
    from public.stores store
    where store.id = requested_store_id and store.active;
    if resolved_store_id is null then
      raise exception 'Unidade de retirada indisponível';
    end if;
  else
    select count(*) into active_store_count
    from public.stores store where store.active;
    if active_store_count <> 1 then
      raise exception 'Escolha a unidade responsável pela encomenda';
    end if;
    select store.id into resolved_store_id
    from public.stores store
    where store.active
    order by store.created_at, store.id
    limit 1;
  end if;

  response := public.submit_service_request_bff_unscoped_internal(
    requested_operation_key,
    requested_product_id,
    requested_customer_name,
    requested_customer_phone,
    requested_customer_email,
    requested_quantity,
    requested_start,
    requested_end,
    requested_location,
    requested_selections,
    requested_notes,
    requested_profile_id
  );

  if not coalesce((response->>'accepted')::boolean, false) then
    return response || jsonb_build_object('store_id', resolved_store_id);
  end if;

  target_request_id := nullif(response->>'request_id', '')::uuid;
  update public.service_requests
  set store_id = resolved_store_id
  where id = target_request_id
    and (store_id is null or store_id = resolved_store_id);

  if not found then
    raise exception 'A chave da solicitação já pertence a outra unidade';
  end if;

  return response || jsonb_build_object('store_id', resolved_store_id);
end;
$$;

revoke all on function public.submit_service_request_bff(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid,uuid
) from public, anon, authenticated;
grant execute on function public.submit_service_request_bff(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid,uuid
) to service_role;

-- O RPC antigo é mantido apenas como implementação interna. O wrapper filtra
-- cada linha pela capacidade efetiva na loja, independentemente do navegador.
alter function public.staff_get_service_request_workspace(text,text,integer)
  rename to staff_get_service_request_workspace_unscoped_internal;
revoke all on function public.staff_get_service_request_workspace_unscoped_internal(text,text,integer)
  from public, anon, authenticated;

create function public.staff_get_service_request_workspace(
  search_text text default '',
  requested_status text default null,
  result_limit integer default 80,
  requested_store_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  unscoped jsonb;
begin
  if requested_store_id is not null
     and not private.staff_has_capability(requested_store_id, 'manage_orders') then
    raise exception 'Acesso à unidade não autorizado';
  end if;

  unscoped := public.staff_get_service_request_workspace_unscoped_internal(
    search_text, requested_status, result_limit
  );

  return coalesce((
    select jsonb_agg(
      item.value || jsonb_build_object('store_id', request.store_id)
      order by item.ordinality
    )
    from jsonb_array_elements(coalesce(unscoped, '[]'::jsonb))
      with ordinality item(value, ordinality)
    join public.service_requests request
      on request.id = nullif(item.value->>'id', '')::uuid
    where (requested_store_id is null or request.store_id = requested_store_id)
      and private.staff_has_capability(request.store_id, 'manage_orders')
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.staff_get_service_request_workspace(text,text,integer,uuid)
  from public, anon, authenticated;
grant execute on function public.staff_get_service_request_workspace(text,text,integer,uuid)
  to authenticated;

alter function public.staff_get_customer_service_request_history(uuid,integer)
  rename to staff_get_customer_service_request_history_unscoped_internal;
revoke all on function public.staff_get_customer_service_request_history_unscoped_internal(uuid,integer)
  from public, anon, authenticated;

create function public.staff_get_customer_service_request_history(
  target_profile_id uuid,
  result_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  unscoped jsonb;
begin
  unscoped := public.staff_get_customer_service_request_history_unscoped_internal(
    target_profile_id, result_limit
  );

  return coalesce((
    select jsonb_agg(
      item.value || jsonb_build_object('store_id', request.store_id)
      order by item.ordinality
    )
    from jsonb_array_elements(coalesce(unscoped, '[]'::jsonb))
      with ordinality item(value, ordinality)
    join public.service_requests request
      on request.id = nullif(item.value->>'id', '')::uuid
    where private.staff_has_capability(request.store_id, 'manage_customers')
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.staff_get_customer_service_request_history(uuid,integer)
  from public, anon, authenticated;
grant execute on function public.staff_get_customer_service_request_history(uuid,integer)
  to authenticated;

-- Pós-gate fail-closed da superfície completa.
do $$
declare
  locked_service_request_tables text[] := array[
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
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(locked_service_request_tables) table_name
  where to_regclass(format('public.%I', table_name)) is null;
  if coalesce(cardinality(missing_tables), 0) > 0 then
    raise exception 'Service-request RPC-only tables expected by the boundary are missing: %',
      missing_tables;
  end if;

  select array_agg(class.relname order by class.relname)
  into rls_disabled
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any(locked_service_request_tables)
    and class.relkind in ('r', 'p')
    and not class.relrowsecurity;
  if coalesce(cardinality(rls_disabled), 0) > 0 then
    raise exception 'RLS disabled on service-request RPC-only tables: %', rls_disabled;
  end if;

  select array_agg(format('%s:%s:%s', class.relname, role_name, privilege_name)
    order by class.relname, role_name, privilege_name)
  into browser_privileges
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  cross join lateral unnest(array['anon', 'authenticated']) role_name
  cross join lateral unnest(array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ]) privilege_name
  where namespace.nspname = 'public'
    and class.relname = any(locked_service_request_tables)
    and has_table_privilege(
      role_name::name,
      format('%I.%I', namespace.nspname, class.relname),
      privilege_name
    );
  if coalesce(cardinality(browser_privileges), 0) > 0 then
    raise exception 'Service-request RPC-only tables still expose browser privileges: %',
      browser_privileges;
  end if;

  select array_agg(format('%s:%s:%s', policy.tablename, policy.policyname, role_name)
    order by policy.tablename, policy.policyname, role_name)
  into browser_policies
  from pg_policies policy
  cross join lateral unnest(policy.roles) expanded_role(role_name)
  where policy.schemaname = 'public'
    and policy.tablename = any(locked_service_request_tables)
    and role_name::text in ('public', 'anon', 'authenticated');
  if coalesce(cardinality(browser_policies), 0) > 0 then
    raise exception 'Service-request RPC-only tables still expose browser policies: %',
      browser_policies;
  end if;

  if not exists (
    select 1 from information_schema.columns column_info
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
      on child_column.attrelid = child_table.oid and child_column.attnum = child_key.attnum
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
      on child_column.attrelid = child_table.oid and child_column.attnum = child_key.attnum
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
  if to_regprocedure(
    'public.staff_get_service_request_workspace(text,text,integer,uuid)'
  ) is null then
    raise exception 'staff_get_service_request_workspace lost the store filter signature';
  end if;
end;
$$;

commit;
