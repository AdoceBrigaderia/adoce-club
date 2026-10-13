begin;

alter table public.costing_items
  add column reference_package_name text check (reference_package_name is null or length(btrim(reference_package_name)) between 1 and 60),
  add column reference_quantity numeric(16,6) check (reference_quantity is null or reference_quantity > 0),
  add column reference_unit text check (reference_unit is null or reference_unit in ('g', 'kg', 'ml', 'l', 'unit'));
alter table public.costing_items add constraint costing_reference_complete_check
  check ((reference_package_name is null and reference_quantity is null and reference_unit is null)
    or (reference_package_name is not null and reference_quantity is not null and reference_unit is not null));

create or replace function public.manager_set_costing_item_reference(
  target_item_id uuid, next_package_name text, next_quantity numeric, next_unit text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare base_unit text;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem alterar a referência de compra'; end if;
  select item.consumption_unit into base_unit from public.costing_items item
  where item.id = target_item_id and item.active and item.item_kind in ('ingredient', 'packaging');
  if base_unit is null then raise exception 'Insumo ou embalagem não encontrado'; end if;
  if nullif(btrim(coalesce(next_package_name, '')), '') is null and next_quantity is null and next_unit is null then
    update public.costing_items set reference_package_name = null, reference_quantity = null, reference_unit = null,
      updated_by = (select auth.uid()), updated_at = now() where id = target_item_id;
  else
    if length(btrim(coalesce(next_package_name, ''))) not between 1 and 60
      or next_quantity is null or next_quantity <= 0 or next_quantity > 999999999
      or next_unit not in ('g', 'kg', 'ml', 'l', 'unit')
      or not (next_unit = base_unit or (base_unit = 'g' and next_unit = 'kg')
        or (base_unit = 'ml' and next_unit = 'l')) then
      raise exception 'Referência de compra incompatível com a unidade de custo';
    end if;
    update public.costing_items set reference_package_name = btrim(next_package_name),
      reference_quantity = next_quantity, reference_unit = next_unit,
      updated_by = (select auth.uid()), updated_at = now() where id = target_item_id;
  end if;
  return jsonb_build_object('item_id', target_item_id);
end;
$$;

create or replace function public.manager_create_costing_item_with_reference(
  next_internal_code text, next_name text, next_item_kind text, next_consumption_unit text,
  next_package_name text, next_quantity numeric, next_unit text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare saved_item_id uuid;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem cadastrar insumos'; end if;
  if next_item_kind not in ('ingredient', 'packaging') or next_consumption_unit not in ('g', 'ml', 'unit') then
    raise exception 'Tipo ou unidade de custo inválida';
  end if;
  perform public.manager_save_costing_catalog_item(
    next_internal_code => next_internal_code, next_name => next_name,
    next_item_kind => next_item_kind, next_purchase_unit => next_consumption_unit,
    next_consumption_unit => next_consumption_unit, next_cost_origin => 'purchased',
    next_commercial_status => 'internal'
  );
  select id into saved_item_id from public.costing_items where internal_code = upper(btrim(next_internal_code));
  if saved_item_id is null then raise exception 'Item recém-cadastrado não encontrado'; end if;
  perform public.manager_set_costing_item_reference(saved_item_id, next_package_name, next_quantity, next_unit);
  return jsonb_build_object('item_id', saved_item_id);
end;
$$;

create or replace function public.manager_get_costing_technical_workspace()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
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
      ) from public.costing_item_prices p where p.item_id = i.id
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
      'flavor_id', r.flavor_id, 'active', r.active
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
$$;

create or replace function public.manager_save_costing_purchase_invoice_v2(
  next_supplier_name text, next_invoice_number text, next_series text, next_issued_on date,
  next_discount_total numeric, next_freight_total numeric, next_notes text, next_lines jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  line jsonb;
  layer jsonb;
  normalized_line jsonb;
  normalized_lines jsonb := '[]'::jsonb;
  saved_invoice jsonb;
  saved_unit_id uuid;
  saved_item_id uuid;
  definition_quantity numeric;
  definition_unit text;
  content_count numeric;
  physical_content_quantity numeric;
  outer_count numeric;
  unit_price numeric;
  line_index integer := 0;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem cadastrar notas de custo'; end if;
  if jsonb_typeof(next_lines) is distinct from 'array' or jsonb_array_length(next_lines) not between 1 and 100 then
    raise exception 'A nota deve ter de 1 a 100 itens';
  end if;
  for line in select value from jsonb_array_elements(next_lines) value loop
    line_index := line_index + 1;
    if jsonb_typeof(line) is distinct from 'object' or jsonb_typeof(line->'package_layers') is distinct from 'array'
      or jsonb_array_length(line->'package_layers') not between 1 and 5 then
      raise exception 'Embalagem inválida na linha %', line_index;
    end if;
    if length(btrim(coalesce(line->>'brand_name', ''))) > 120 or length(btrim(coalesce(line->>'item_notes', ''))) > 1000 then
      raise exception 'Marca ou observação longa demais na linha %', line_index;
    end if;
    outer_count := nullif(line->'package_layers'->0->>'quantity', '')::numeric;
    unit_price := nullif(line->>'unit_price', '')::numeric;
    if outer_count is null or outer_count <= 0 or mod(outer_count, 1) <> 0 or outer_count > 1000000 then
      raise exception 'Quantidade externa inválida na linha %', line_index;
    end if;
    if unit_price is null or unit_price < 0 or unit_price > 9999999999 or round(unit_price, 4) <> unit_price
      or unit_price * outer_count > 9999999999 then
      raise exception 'Preço unitário inválido na linha %', line_index;
    end if;
    for layer in select value from jsonb_array_elements(line->'package_layers') value loop
      if length(btrim(coalesce(layer->>'name', ''))) not between 1 and 40 then
        raise exception 'Tipo de embalagem inválido na linha %', line_index;
      end if;
      insert into public.costing_package_types(name, created_by)
      values (btrim(layer->>'name'), (select auth.uid())) on conflict do nothing;
    end loop;

    content_count := nullif(line->>'content_quantity', '')::numeric;
    if content_count is null or content_count <= 0 or content_count > 999999999 then
      raise exception 'Conteúdo inválido na linha %', line_index;
    end if;
    saved_unit_id := null;
    if nullif(line->>'content_unit_catalog_id', '') is not null then
      saved_unit_id := (line->>'content_unit_catalog_id')::uuid;
      select u.physical_quantity, u.physical_unit into definition_quantity, definition_unit
      from public.costing_content_units u where u.id = saved_unit_id;
      if definition_quantity is null then raise exception 'Unidade cadastrada não encontrada na linha %', line_index; end if;
    elsif nullif(btrim(coalesce(line->>'new_content_unit_name', '')), '') is not null then
      if length(btrim(line->>'new_content_unit_name')) > 80 then raise exception 'Nome da unidade muito longo na linha %', line_index; end if;
      definition_quantity := nullif(line->>'new_content_unit_quantity', '')::numeric;
      definition_unit := line->>'new_content_unit_physical_unit';
      if definition_quantity is null or definition_quantity <= 0 or definition_quantity > 999999999
        or definition_unit not in ('g', 'kg', 'ml', 'l', 'unit') then
        raise exception 'Definição da nova unidade inválida na linha %', line_index;
      end if;
      insert into public.costing_content_units(name, physical_quantity, physical_unit, created_by)
      values (btrim(line->>'new_content_unit_name'), definition_quantity, definition_unit, (select auth.uid()))
      on conflict do nothing returning id into saved_unit_id;
      if saved_unit_id is null then
        select u.id, u.physical_quantity, u.physical_unit into saved_unit_id, physical_content_quantity, definition_unit
        from public.costing_content_units u where lower(btrim(u.name)) = lower(btrim(line->>'new_content_unit_name'));
        if physical_content_quantity <> definition_quantity or definition_unit <> line->>'new_content_unit_physical_unit' then
          raise exception 'Esta unidade já existe com outra definição na linha %', line_index;
        end if;
      end if;
    else
      definition_quantity := 1;
      definition_unit := line->>'content_unit';
      if definition_unit not in ('g', 'kg', 'ml', 'l', 'unit') then
        raise exception 'Unidade do conteúdo inválida na linha %', line_index;
      end if;
    end if;
    physical_content_quantity := round(content_count * definition_quantity, 6);
    if physical_content_quantity <= 0 or physical_content_quantity > 9999999999 then
      raise exception 'Conteúdo convertido fora do limite na linha %', line_index;
    end if;
    normalized_line := line || jsonb_build_object(
      'gross_total', round(unit_price * outer_count, 4),
      'content_quantity', physical_content_quantity, 'content_unit', definition_unit,
      'entered_content_quantity', content_count, 'content_unit_catalog_id', saved_unit_id
    );
    normalized_lines := normalized_lines || jsonb_build_array(normalized_line);
  end loop;

  saved_invoice := public.manager_save_costing_purchase_invoice(
    next_supplier_name, next_invoice_number, next_series, next_issued_on,
    next_discount_total, next_freight_total, next_notes, normalized_lines
  );
  line_index := 0;
  for normalized_line in select value from jsonb_array_elements(normalized_lines) value loop
    line_index := line_index + 1;
    update public.costing_purchase_invoice_lines purchase_line set
      outer_unit_price = (normalized_line->>'unit_price')::numeric,
      content_unit_catalog_id = nullif(normalized_line->>'content_unit_catalog_id', '')::uuid,
      entered_content_quantity = (normalized_line->>'entered_content_quantity')::numeric,
      brand_name = btrim(coalesce(normalized_line->>'brand_name', '')),
      item_notes = btrim(coalesce(normalized_line->>'item_notes', ''))
    where purchase_line.invoice_id = (saved_invoice->>'id')::uuid and purchase_line.line_number = line_index;
    if nullif(normalized_line->>'new_item_name', '') is not null
      and (normalized_line->>'reference_package_name' is not null
        or normalized_line->>'reference_quantity' is not null
        or normalized_line->>'reference_unit' is not null) then
      select purchase_line.item_id into saved_item_id from public.costing_purchase_invoice_lines purchase_line
      where purchase_line.invoice_id = (saved_invoice->>'id')::uuid and purchase_line.line_number = line_index;
      perform public.manager_set_costing_item_reference(saved_item_id, normalized_line->>'reference_package_name',
        nullif(normalized_line->>'reference_quantity', '')::numeric, normalized_line->>'reference_unit');
    end if;
  end loop;
  return saved_invoice;
end;
$$;

revoke all on function public.manager_get_costing_technical_workspace() from public, anon, authenticated;
grant execute on function public.manager_get_costing_technical_workspace() to authenticated;
revoke all on function public.manager_set_costing_item_reference(uuid, text, numeric, text) from public, anon, authenticated;
grant execute on function public.manager_set_costing_item_reference(uuid, text, numeric, text) to authenticated;
revoke all on function public.manager_create_costing_item_with_reference(text, text, text, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.manager_create_costing_item_with_reference(text, text, text, text, text, numeric, text) to authenticated;
revoke all on function public.manager_save_costing_purchase_invoice_v2(text, text, text, date, numeric, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.manager_save_costing_purchase_invoice_v2(text, text, text, date, numeric, numeric, text, jsonb) to authenticated;

comment on column public.costing_items.reference_package_name is 'Nome da embalagem de referência para comparação visual de preços.';
comment on column public.costing_items.reference_quantity is 'Conteúdo da embalagem de referência; não altera o custo base ou estoque.';

commit;