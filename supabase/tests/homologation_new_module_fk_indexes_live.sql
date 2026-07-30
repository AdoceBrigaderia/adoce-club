\set ON_ERROR_STOP on

begin;

select pg_advisory_xact_lock(hashtextextended('adoce:homologation:new-module-fk-indexes-audit', 0));

do $$
declare
  target record;
  target_relation regclass;
  target_attribute smallint;
begin
  for target in
    select *
    from (values
      ('cake_builder_options', 'costing_snapshot_id', 'idx_cake_builder_options_costing_snapshot_id'),
      ('costing_recipe_components', 'child_recipe_version_id', 'idx_costing_recipe_components_child_recipe_version_id'),
      ('costing_recipe_components', 'item_id', 'idx_costing_recipe_components_item_id'),
      ('service_request_cake_builds', 'template_id', 'idx_service_request_cake_builds_template_id'),
      ('service_request_pricing_snapshots', 'cost_snapshot_id', 'idx_service_request_pricing_snapshots_cost_snapshot_id'),
      ('service_request_pricing_snapshots', 'recipe_version_id', 'idx_service_request_pricing_snapshots_recipe_version_id'),
      ('service_request_product_configurations', 'product_id', 'idx_service_request_product_configurations_product_id')
    ) expected(table_name, column_name, index_name)
  loop
    target_relation := to_regclass(format('public.%I', target.table_name));
    if target_relation is null then
      raise exception 'Tabela esperada ausente: public.%', target.table_name;
    end if;

    select attribute.attnum
    into target_attribute
    from pg_attribute attribute
    where attribute.attrelid = target_relation
      and attribute.attname = target.column_name
      and not attribute.attisdropped;

    if target_attribute is null then
      raise exception 'Coluna esperada ausente: public.%.%', target.table_name, target.column_name;
    end if;

    if to_regclass(format('public.%I', target.index_name)) is null then
      raise exception 'Índice esperado ausente: public.%', target.index_name;
    end if;

    if not exists (
      select 1
      from pg_index index_record
      where index_record.indrelid = target_relation
        and index_record.indexrelid = to_regclass(format('public.%I', target.index_name))
        and index_record.indisvalid
        and index_record.indisready
        and index_record.indkey[0] = target_attribute
    ) then
      raise exception 'Índice não cobre public.%.%: public.%', target.table_name, target.column_name, target.index_name;
    end if;
  end loop;
end;
$$;

select
  relation.relname as table_name,
  index_relation.relname as index_name,
  pg_get_indexdef(index_relation.oid) as index_definition
from pg_index index_record
join pg_class relation on relation.oid = index_record.indrelid
join pg_class index_relation on index_relation.oid = index_record.indexrelid
join pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and index_relation.relname in (
    'idx_cake_builder_options_costing_snapshot_id',
    'idx_costing_recipe_components_child_recipe_version_id',
    'idx_costing_recipe_components_item_id',
    'idx_service_request_cake_builds_template_id',
    'idx_service_request_pricing_snapshots_cost_snapshot_id',
    'idx_service_request_pricing_snapshots_recipe_version_id',
    'idx_service_request_product_configurations_product_id'
  )
order by relation.relname, index_relation.relname;

rollback;
