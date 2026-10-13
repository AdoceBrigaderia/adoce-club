-- Fichas e preparações passam a ser editadas no mesmo registro (mesmo recipe_version_id),
-- em vez de criar uma versão nova a cada salvamento. Isso garante que o planejamento de
-- compras e o custo das fichas que usam uma preparação acompanhem a composição atual
-- automaticamente. O histórico de custo de uma venda concluída deve ser preservado por um
-- registro próprio da venda, nunca pelo congelamento da receita.
CREATE OR REPLACE FUNCTION public.manager_save_costing_technical_sheet(target_recipe_id uuid, next_name text, next_kind text, next_flavor_id uuid, next_size_code text, next_yield_quantity numeric, next_yield_unit text, next_components jsonb, next_reason text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  saved_recipe_id uuid;
  saved_version_id uuid;
  next_version integer;
  entry jsonb;
  child_id uuid;
  item_ref uuid;
  component_kind text;
  component_unit text;
  component_quantity numeric;
  cycle_found boolean;
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem alterar fichas técnicas';
  end if;
  if next_kind = 'final_product' then
    next_components := private.costing_required_cake_components(next_components);
  end if;
  if btrim(coalesce(next_name, '')) = '' or length(btrim(next_name)) > 180 then
    raise exception 'Nome da ficha inválido';
  end if;
  if next_kind not in ('intermediate', 'final_product') then raise exception 'Tipo de ficha inválido'; end if;
  if next_kind = 'final_product' and (next_flavor_id is null or coalesce(next_size_code, '') not in ('P','M','G','GG')) then
    raise exception 'Sabor e tamanho são obrigatórios para tortas';
  end if;
  if next_kind = 'intermediate' and (next_flavor_id is not null or next_size_code is not null) then
    raise exception 'Preparação não pode usar sabor ou tamanho';
  end if;
  if next_yield_quantity is not null and next_yield_quantity <= 0 then raise exception 'Rendimento inválido'; end if;
  if next_yield_unit is not null and next_yield_unit not in ('g','kg','ml','l','unit','cake','slice','batch','other') then
    raise exception 'Unidade de rendimento inválida';
  end if;
  if (next_yield_quantity is null) <> (next_yield_unit is null) then
    raise exception 'Informe quantidade e unidade de rendimento juntas';
  end if;
  if next_components is null or jsonb_typeof(next_components) <> 'array' or jsonb_array_length(next_components) > 200 then
    raise exception 'Lista de componentes inválida';
  end if;
  if next_flavor_id is not null and not exists (select 1 from public.flavors where id = next_flavor_id) then
    raise exception 'Sabor inexistente';
  end if;
  if target_recipe_id is null then
    insert into public.costing_recipes(internal_code, name, recipe_kind, flavor_id, output_unit, created_by, updated_by)
    values ('SHEET-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 28)),
      btrim(next_name), next_kind, next_flavor_id,
      coalesce(next_yield_unit, case when next_kind = 'final_product' then 'cake' else 'other' end),
      (select auth.uid()), (select auth.uid()))
    returning id into saved_recipe_id;
  else
    select r.id into saved_recipe_id from public.costing_recipes r where r.id = target_recipe_id for update;
    if saved_recipe_id is null then raise exception 'Ficha não encontrada'; end if;
    if exists (select 1 from public.costing_recipes r where r.id = saved_recipe_id
      and (r.recipe_kind <> next_kind or r.flavor_id is distinct from next_flavor_id)) then
      raise exception 'O vínculo da ficha não pode ser trocado';
    end if;
    update public.costing_recipes set name = btrim(next_name), updated_at = now(), updated_by = (select auth.uid())
    where id = saved_recipe_id;
  end if;

  select v.id into saved_version_id from public.costing_recipe_versions v
   where v.recipe_id = saved_recipe_id and v.size_code is not distinct from next_size_code
   order by v.version_number desc limit 1;

  if saved_version_id is null then
    insert into public.costing_recipe_versions(
      recipe_id, version_number, version_status, yield_quantity, yield_unit, size_code,
      change_reason, created_by
    ) values (
      saved_recipe_id, 1, 'draft', next_yield_quantity, next_yield_unit,
      next_size_code, left(coalesce(next_reason, ''), 1000), (select auth.uid())
    ) returning id into saved_version_id;
    next_version := 1;
  else
    update public.costing_recipe_versions
    set yield_quantity = next_yield_quantity, yield_unit = next_yield_unit,
        change_reason = left(coalesce(next_reason, ''), 1000)
    where id = saved_version_id
    returning version_number into next_version;
    delete from public.costing_recipe_components where recipe_version_id = saved_version_id;
  end if;

  for entry in select value from jsonb_array_elements(next_components) loop
    component_kind := entry->>'kind';
    component_unit := case when entry->>'unit' = 'unidade' then 'unit' else entry->>'unit' end;
    if coalesce(component_kind, '') not in ('item', 'recipe_version') or
       coalesce(component_unit, '') not in ('g','kg','ml','l','unit','package','box','can','tray','hour','kwh','cake','slice','batch','other') then
      raise exception 'Tipo ou unidade do componente inválido';
    end if;
    if entry ? 'quantity' and nullif(entry->>'quantity', '') is not null then
      component_quantity := (entry->>'quantity')::numeric;
      if component_quantity <= 0 then raise exception 'Quantidade do componente inválida'; end if;
    else component_quantity := null; end if;
    if component_kind = 'item' then
      item_ref := (entry->>'id')::uuid; child_id := null;
      if not exists (select 1 from public.costing_items i where i.id = item_ref and i.active) then
        raise exception 'Insumo inexistente ou inativo';
      end if;
    else
      child_id := (entry->>'id')::uuid; item_ref := null;
      if child_id = saved_version_id then raise exception 'Uma preparação não pode usar a si mesma'; end if;
      if not exists (select 1 from public.costing_recipe_versions v
        join public.costing_recipes r on r.id = v.recipe_id
        where v.id = child_id and r.recipe_kind = 'intermediate') then
        raise exception 'Versão de preparação inexistente';
      end if;
    end if;
    insert into public.costing_recipe_components(
      recipe_version_id, component_kind, item_id, child_recipe_version_id,
      quantity, unit, placement, sort_order
    ) values (
      saved_version_id, component_kind, item_ref, child_id,
      component_quantity, component_unit,
      left(coalesce(nullif(btrim(entry->>'placement'), ''), 'composition'), 80),
      coalesce((entry->>'sort_order')::integer, 0)
    );
  end loop;
  with recursive deps(version_id, path, cycle) as (
    select saved_version_id, array[saved_version_id], false
    union all
    select c.child_recipe_version_id, d.path || c.child_recipe_version_id,
      c.child_recipe_version_id = any(d.path)
    from deps d
    join public.costing_recipe_components c on c.recipe_version_id = d.version_id
    where c.child_recipe_version_id is not null and not d.cycle and cardinality(d.path) < 100
  ) select exists(select 1 from deps where cycle) into cycle_found;
  if cycle_found then raise exception 'Dependência circular na ficha'; end if;
  return jsonb_build_object('recipe_id', saved_recipe_id, 'version_id', saved_version_id, 'version_number', next_version);
end;
$function$;

CREATE OR REPLACE FUNCTION public.manager_save_costing_sheet_with_times(target_recipe_id uuid, next_name text, next_kind text, next_flavor_id uuid, next_size_code text, next_yield_quantity numeric, next_yield_unit text, next_components jsonb, next_reason text, next_preparation_minutes integer, next_cooking_minutes integer, next_cooling_minutes integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path TO ''
AS $function$
declare saved jsonb;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem alterar fichas'; end if;
  if next_preparation_minutes not between 0 and 100000 or next_cooking_minutes not between 0 and 100000
    or next_cooling_minutes not between 0 and 100000 then raise exception 'Informe tempos em minutos inteiros, de 0 a 100000'; end if;
  saved := public.manager_save_costing_technical_sheet(target_recipe_id, next_name, next_kind,
    next_flavor_id, next_size_code, next_yield_quantity, next_yield_unit, next_components, next_reason);
  insert into public.costing_preparation_times(version_id, preparation_minutes, cooking_minutes, cooling_minutes)
  values ((saved->>'version_id')::uuid, next_preparation_minutes, next_cooking_minutes, next_cooling_minutes)
  on conflict (version_id) do update set
    preparation_minutes = excluded.preparation_minutes,
    cooking_minutes = excluded.cooking_minutes,
    cooling_minutes = excluded.cooling_minutes;
  return saved;
end;
$function$;
