begin;

-- Cada torta e composta por 3 "Discos de bolo" (fichas intermediarias).
-- Hoje a cor da massa so existe como convencao no nome da ficha (ex.:
-- "MASSA AMANTEIGADA"). Esta migracao cria um campo estruturado pra isso,
-- preenche automaticamente as 4 fichas de massa ja cadastradas, e expoe o
-- campo na workspace de fichas tecnicas (usada pelo planejamento de
-- compras para calcular a massa predominante de cada sabor).

alter table public.costing_recipes
  add column if not exists batter_color text
  check (batter_color is null or batter_color in ('Branca', 'Chocolate', 'Black', 'Red', 'Outra'));

comment on column public.costing_recipes.batter_color is
  'Cor da massa, só relevante para fichas intermediárias usadas como "Discos de bolo". Usado para calcular a massa predominante de cada sabor no planejamento de compras.';

update public.costing_recipes
set batter_color = case name
  when 'MASSA AMANTEIGADA' then 'Branca'
  when 'MASSA CHOCOLATE' then 'Chocolate'
  when 'MASSA BLACK' then 'Black'
  when 'MASSA RED' then 'Red'
  else null
end
where recipe_kind = 'intermediate'
  and name in ('MASSA AMANTEIGADA', 'MASSA CHOCOLATE', 'MASSA BLACK', 'MASSA RED')
  and batter_color is null;

create or replace function public.manager_get_costing_technical_workspace()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem acessar fichas técnicas';
  end if;
  return jsonb_build_object(
    'flavors', coalesce((select jsonb_agg(jsonb_build_object(
      'id', f.id, 'name', f.name, 'base_price', f.base_price, 'active', f.active
    ) order by f.name) from public.flavors f), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'name', i.name, 'item_kind', i.item_kind,
      'purchase_unit', i.purchase_unit, 'consumption_unit', i.consumption_unit,
      'reference_package_name', i.reference_package_name, 'reference_quantity', i.reference_quantity,
      'reference_unit', i.reference_unit,
      'data_status', i.data_status, 'active', i.active,
      'price', (select jsonb_build_object(
        'purchase_price', p.purchase_price, 'purchased_quantity', p.purchased_quantity,
        'purchase_unit', p.purchase_unit, 'useful_quantity', p.useful_quantity,
        'data_status', p.data_status, 'effective_at', p.effective_at
      ) from public.costing_item_prices p where p.item_id = i.id and not exists (select 1 from public.costing_purchase_invoices archived where archived.id=p.source_invoice_id and (archived.replaced_by is not null or archived.archived_at is not null))
      order by p.effective_at desc, p.created_at desc limit 1)
    ) order by i.name) from public.costing_items i), '[]'::jsonb),
    'prices', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'item_id', p.item_id, 'purchase_price', p.purchase_price,
      'purchased_quantity', p.purchased_quantity, 'purchase_unit', p.purchase_unit,
      'useful_quantity', p.useful_quantity, 'data_status', p.data_status,
      'effective_at', p.effective_at, 'source_note', p.source_note
    ) order by p.effective_at desc, p.created_at desc)
    from public.costing_item_prices p), '[]'::jsonb),
    'recipes', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name, 'recipe_kind', r.recipe_kind,
      'flavor_id', r.flavor_id, 'active', r.active, 'batter_color', r.batter_color
    ) order by r.name) from public.costing_recipes r), '[]'::jsonb),
    'versions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', v.id, 'recipe_id', v.recipe_id, 'version_number', v.version_number,
      'version_status', v.version_status, 'yield_quantity', v.yield_quantity,
      'yield_unit', v.yield_unit, 'size_code', v.size_code, 'created_at', v.created_at
    ) order by v.recipe_id, v.version_number) from public.costing_recipe_versions v), '[]'::jsonb),
    'components', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'recipe_version_id', c.recipe_version_id, 'component_kind', c.component_kind,
      'item_id', c.item_id, 'child_recipe_version_id', c.child_recipe_version_id,
      'quantity', c.quantity, 'unit', c.unit, 'placement', c.placement,
      'sort_order', c.sort_order
    ) order by c.recipe_version_id, c.sort_order) from public.costing_recipe_components c), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.manager_set_costing_recipe_batter_color(
  target_recipe_id uuid,
  next_color text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_manager(), false) then
    raise exception 'Acesso restrito à gestão';
  end if;
  if next_color is not null and next_color not in ('Branca', 'Chocolate', 'Black', 'Red', 'Outra') then
    raise exception 'Cor de massa inválida';
  end if;
  update public.costing_recipes
  set batter_color = next_color
  where id = target_recipe_id and recipe_kind = 'intermediate';
  if not found then
    raise exception 'Ficha intermediária não encontrada';
  end if;
end;
$$;

revoke all on function public.manager_set_costing_recipe_batter_color(uuid, text)
  from public, anon;
grant execute on function public.manager_set_costing_recipe_batter_color(uuid, text)
  to authenticated;

comment on function public.manager_set_costing_recipe_batter_color(uuid, text) is
  'Define a cor da massa de uma ficha intermediária (usada como "Discos de bolo"), para calcular a massa predominante de cada sabor.';

commit;
