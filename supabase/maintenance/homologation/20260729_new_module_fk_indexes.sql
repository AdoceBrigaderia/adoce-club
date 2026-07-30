begin;

select pg_advisory_xact_lock(hashtextextended('adoce:homologation:new-module-fk-indexes', 0));

create index if not exists idx_cake_builder_options_costing_snapshot_id
  on public.cake_builder_options(costing_snapshot_id);

create index if not exists idx_costing_recipe_components_child_recipe_version_id
  on public.costing_recipe_components(child_recipe_version_id);

create index if not exists idx_costing_recipe_components_item_id
  on public.costing_recipe_components(item_id);

create index if not exists idx_service_request_cake_builds_template_id
  on public.service_request_cake_builds(template_id);

create index if not exists idx_service_request_pricing_snapshots_cost_snapshot_id
  on public.service_request_pricing_snapshots(cost_snapshot_id);

create index if not exists idx_service_request_pricing_snapshots_recipe_version_id
  on public.service_request_pricing_snapshots(recipe_version_id);

create index if not exists idx_service_request_product_configurations_product_id
  on public.service_request_product_configurations(product_id);

do $$
declare
  index_name text;
  expected_indexes constant text[] := array[
    'idx_cake_builder_options_costing_snapshot_id',
    'idx_costing_recipe_components_child_recipe_version_id',
    'idx_costing_recipe_components_item_id',
    'idx_service_request_cake_builds_template_id',
    'idx_service_request_pricing_snapshots_cost_snapshot_id',
    'idx_service_request_pricing_snapshots_recipe_version_id',
    'idx_service_request_product_configurations_product_id'
  ];
begin
  foreach index_name in array expected_indexes loop
    if to_regclass(format('public.%I', index_name)) is null then
      raise exception 'Índice esperado ausente: public.%', index_name;
    end if;
    if not exists (
      select 1
      from pg_index index_record
      where index_record.indexrelid = to_regclass(format('public.%I', index_name))
        and index_record.indisvalid
        and index_record.indisready
    ) then
      raise exception 'Índice inválido ou indisponível: public.%', index_name;
    end if;
  end loop;
end;
$$;

commit;
