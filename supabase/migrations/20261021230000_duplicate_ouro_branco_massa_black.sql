begin;

-- Pedido do proprietario: separar o sabor "Ouro Branco" em dois cadastros
-- distintos por massa, ja que a ficha atual usa MASSA CHOCOLATE nos discos
-- (nao amanteigada, apesar do nome). O sabor antigo so e renomeado (os
-- discos continuam como estao hoje, por decisao do proprietario); o novo e
-- uma copia completa do cadastro e da ficha, com os 3 discos trocados para
-- MASSA BLACK.

do $$
declare
  old_flavor_id uuid := 'afb6e9cd-18ac-4780-87c5-90a59f97da18';
  old_recipe_id uuid := '8c1ce996-bd8a-4eeb-8cf5-5581cc37fcbf';
  old_version_id uuid := 'b0540e50-3519-413f-8b3b-81474f793d54';
  massa_black_version_id uuid := '8b66015f-3f1f-4d9a-9eb4-35f3cbc03227';
  new_flavor_id uuid;
  new_recipe_id uuid;
  new_version_id uuid;
  old_version public.costing_recipe_versions%rowtype;
  component record;
begin
  update public.flavors
  set name = 'Ouro Branco (massa amanteigada)', short_name = 'Ouro Branco (massa amanteigada)'
  where id = old_flavor_id;

  update public.costing_recipes
  set name = 'Ouro Branco (massa amanteigada)'
  where id = old_recipe_id;

  insert into public.flavors (
    name, category, description, image_path, active, sort_order, base_price,
    short_description, ingredients, whole_cake_price, whole_cake_image_path,
    whole_cake_available, whole_cake_original_image_path, slug, short_name
  )
  select
    'Ouro Branco (massa black)', category, description, image_path, active, sort_order + 1, base_price,
    short_description, ingredients, whole_cake_price, whole_cake_image_path,
    whole_cake_available, whole_cake_original_image_path, 'ouro-branco-black', 'Ouro Branco (massa black)'
  from public.flavors
  where id = old_flavor_id
  returning id into new_flavor_id;

  insert into public.costing_recipes (internal_code, name, recipe_kind, output_unit, flavor_id, active)
  values ('SHEET-' || upper(replace(gen_random_uuid()::text, '-', '')), 'Ouro Branco (massa black)', 'final_product', 'slice', new_flavor_id, true)
  returning id into new_recipe_id;

  select * into old_version from public.costing_recipe_versions where id = old_version_id;

  insert into public.costing_recipe_versions (
    recipe_id, version_number, version_status, yield_quantity, yield_unit, size_code
  )
  values (
    new_recipe_id, 1, old_version.version_status, old_version.yield_quantity,
    old_version.yield_unit, old_version.size_code
  )
  returning id into new_version_id;

  for component in
    select * from public.costing_recipe_components where recipe_version_id = old_version_id order by sort_order
  loop
    insert into public.costing_recipe_components (
      recipe_version_id, component_kind, item_id, child_recipe_version_id, quantity, unit, loss_percent, placement, sort_order, notes
    )
    values (
      new_version_id, component.component_kind, component.item_id,
      case when component.placement = 'Discos de bolo' then massa_black_version_id else component.child_recipe_version_id end,
      component.quantity, component.unit, component.loss_percent, component.placement, component.sort_order, component.notes
    );
  end loop;
end;
$$;

commit;
