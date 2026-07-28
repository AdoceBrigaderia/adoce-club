begin;

do $$
declare
  relation_name text;
  role_name text;
  expected_relations constant text[] := array[
    'cake_builder_templates',
    'cake_builder_options',
    'service_request_cake_builds',
    'service_request_product_configurations',
    'service_request_pricing_snapshots',
    'costing_items',
    'costing_item_prices',
    'costing_recipes',
    'costing_recipe_versions',
    'costing_recipe_components',
    'costing_resource_allocations',
    'costing_cost_snapshots'
  ];
  expected_versions constant text[] := array[
    '20260728073000',
    '20260728090000',
    '20260728093000',
    '20260728103000',
    '20260728115000',
    '20260728115100',
    '20260728130000',
    '20260728154500',
    '20260728164000',
    '20260728165116',
    '20260728165303',
    '20260728170236',
    '20260728170246',
    '20260728170307',
    '20260728170501',
    '20260728170941',
    '20260728174500',
    '20260728220000',
    '20260728221500',
    '20260728223000',
    '20260728224500'
  ];
  applied_count integer;
begin
  foreach relation_name in array expected_relations loop
    if to_regclass(format('public.%I', relation_name)) is null then
      raise exception 'Relação esperada ausente após migrations: public.%', relation_name;
    end if;

    if not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = relation_name
        and relation.relrowsecurity
    ) then
      raise exception 'RLS não está habilitado em public.%', relation_name;
    end if;

    foreach role_name in array array['anon', 'authenticated'] loop
      if has_table_privilege(role_name, format('public.%I', relation_name), 'SELECT')
        or has_table_privilege(role_name, format('public.%I', relation_name), 'INSERT')
        or has_table_privilege(role_name, format('public.%I', relation_name), 'UPDATE')
        or has_table_privilege(role_name, format('public.%I', relation_name), 'DELETE')
      then
        raise exception 'Acesso direto inesperado de % em public.%', role_name, relation_name;
      end if;
    end loop;
  end loop;

  if to_regprocedure('private.canonicalize_cake_builder_selection(uuid,jsonb)') is null then
    raise exception 'Função privada de canonicalização do montador não foi criada';
  end if;
  if to_regprocedure('private.canonicalize_configurable_product_selection(uuid,integer,jsonb)') is null then
    raise exception 'Função privada de configuração de produtos não foi criada';
  end if;
  if to_regprocedure('private.redact_internal_product_configuration(jsonb)') is null then
    raise exception 'Redação de custos internos dos produtos não foi criada';
  end if;
  if to_regprocedure('private.capture_service_request_pricing_snapshot(uuid,uuid,integer,jsonb,jsonb)') is null then
    raise exception 'Snapshot financeiro das encomendas configuráveis não foi criado';
  end if;
  if to_regprocedure('public.manager_get_configurable_product_workspace()') is null then
    raise exception 'Workspace administrativo de produtos não foi criado';
  end if;
  if to_regprocedure('public.manager_save_configurable_product(jsonb,jsonb)') is null then
    raise exception 'Gravação administrativa de produtos não foi criada';
  end if;
  if to_regprocedure('public.get_configurable_product_catalog(text)') is null then
    raise exception 'Catálogo público configurável não foi criado';
  end if;
  if to_regprocedure('public.staff_get_service_request_workspace(text,text,integer)') is null then
    raise exception 'Central segura de encomendas não foi criada';
  end if;
  if not exists (
    select 1
    from pg_constraint constraint_record
    where constraint_record.conrelid = 'public.commercial_products'::regclass
      and constraint_record.conname = 'commercial_products_type_mode_check'
  ) then
    raise exception 'Restrição entre tipo de produto e montador não foi criada';
  end if;

  select count(*)
  into applied_count
  from supabase_migrations.schema_migrations
  where version = any(expected_versions);

  if applied_count <> cardinality(expected_versions) then
    raise exception 'Histórico incompleto: % de % migrations de 28/07 registradas', applied_count, cardinality(expected_versions);
  end if;
end;
$$;

rollback;
