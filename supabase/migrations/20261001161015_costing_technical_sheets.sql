begin;

alter table public.costing_recipes
  add column if not exists flavor_id uuid references public.flavors(id) on delete restrict;
create unique index if not exists costing_one_recipe_per_flavor_idx
  on public.costing_recipes(flavor_id) where flavor_id is not null;

alter table public.costing_recipe_versions
  add column if not exists size_code text check (size_code in ('P', 'M', 'G', 'GG'));
alter table public.costing_recipe_versions alter column yield_quantity drop not null;
alter table public.costing_recipe_versions alter column yield_unit drop not null;
alter table public.costing_recipe_components alter column quantity drop not null;

alter table public.costing_item_prices
  add constraint costing_useful_not_above_purchased_check
  check (useful_quantity is null or useful_quantity <= purchased_quantity) not valid;

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

create or replace function public.manager_save_costing_technical_sheet(
  target_recipe_id uuid,
  next_name text,
  next_kind text,
  next_flavor_id uuid,
  next_size_code text,
  next_yield_quantity numeric,
  next_yield_unit text,
  next_components jsonb,
  next_reason text default ''
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
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
  select coalesce(max(v.version_number), 0) + 1 into next_version
  from public.costing_recipe_versions v where v.recipe_id = saved_recipe_id;
  insert into public.costing_recipe_versions(
    recipe_id, version_number, version_status, yield_quantity, yield_unit, size_code,
    change_reason, created_by
  ) values (
    saved_recipe_id, next_version, 'draft', next_yield_quantity, next_yield_unit,
    next_size_code, left(coalesce(next_reason, ''), 1000), (select auth.uid())
  ) returning id into saved_version_id;

  for entry in select value from jsonb_array_elements(next_components) loop
    component_kind := entry->>'kind';
    component_unit := entry->>'unit';
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
$$;

create or replace function public.manager_validate_costing_item(target_item_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_manager() then raise exception 'Acesso negado'; end if;
  if not exists (
    select 1 from public.costing_item_prices p
    where p.item_id = target_item_id and p.data_status = 'validated'
  ) then raise exception 'Registre e confira um preço validado antes de validar o item'; end if;
  update public.costing_items set data_status = 'validated', updated_at = now(), updated_by = (select auth.uid())
  where id = target_item_id and active;
  if not found then raise exception 'Item inexistente ou inativo'; end if;
end;
$$;

revoke all on function public.manager_get_costing_technical_workspace() from public, anon, authenticated;
revoke all on function public.manager_save_costing_technical_sheet(uuid,text,text,uuid,text,numeric,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.manager_validate_costing_item(uuid) from public, anon, authenticated;
grant execute on function public.manager_get_costing_technical_workspace() to authenticated;
grant execute on function public.manager_save_costing_technical_sheet(uuid,text,text,uuid,text,numeric,text,jsonb,text) to authenticated;
grant execute on function public.manager_validate_costing_item(uuid) to authenticated;

commit;
