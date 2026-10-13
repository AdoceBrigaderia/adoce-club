begin;

-- Normalize the two whole-cake consumptions, preserving all other components.
create function private.costing_required_cake_components(components jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb; source record; source_version uuid;
begin
  if components is null or jsonb_typeof(components) <> 'array' then raise exception 'Lista de componentes inválida'; end if;
  select coalesce(jsonb_agg(entry order by ordinal), '[]'::jsonb) into result
  from jsonb_array_elements(components) with ordinality as e(entry, ordinal)
  where not exists (
    select 1 from public.costing_recipe_versions v join public.costing_recipes r on r.id=v.recipe_id
    where entry->>'kind'='recipe_version' and v.id::text=entry->>'id'
      and upper(btrim(r.name)) in ('DESMOLDANTE FORMAS','IRRIGAÇÃO')
  );
  for source in select * from (values ('DESMOLDANTE FORMAS',40,'g'),('IRRIGAÇÃO',300,'ml')) as s(name,quantity,unit) loop
    select v.id into source_version from public.costing_recipes r
    join lateral (select * from public.costing_recipe_versions where recipe_id=r.id and size_code is null order by version_number desc limit 1) v on true
    where r.active and r.recipe_kind='intermediate' and upper(btrim(r.name))=source.name
      and v.yield_quantity>0 and v.yield_unit=source.unit;
    if source_version is null then raise exception 'Confira a preparação % e seu rendimento em %',source.name,source.unit; end if;
    result := result || jsonb_build_array(jsonb_build_object('kind','recipe_version','id',source_version,
      'quantity',source.quantity,'unit',source.unit,'placement','Desmoldante e irrigação','sort_order',jsonb_array_length(result)));
  end loop;
  if jsonb_array_length(result)>200 then raise exception 'Lista de componentes inválida'; end if;
  return result;
end;
$$;
revoke all on function private.costing_required_cake_components(jsonb) from public,anon,authenticated;

-- Modify the live save function without losing its existing authorization and unit compatibility.
do $$
declare definition text; marker text := '  if btrim(coalesce(next_name';
begin
  select pg_get_functiondef('public.manager_save_costing_technical_sheet(uuid,text,text,uuid,text,numeric,text,jsonb,text)'::regprocedure) into definition;
  if strpos(definition,marker)=0 then raise exception 'Função de gravação mudou; revisão necessária'; end if;
  definition := replace(definition,marker,E'  if next_kind = ''final_product'' then\n    next_components := private.costing_required_cake_components(next_components);\n  end if;\n' || marker);
  execute definition;
end;
$$;

-- New current versions: immutable historical versions and their references remain intact.
do $$
declare previous record; next_id uuid; next_number integer; component jsonb; normalized jsonb;
begin
  lock table public.costing_recipes in share row exclusive mode;
  for previous in
    select distinct on (v.recipe_id,v.size_code) v.* from public.costing_recipe_versions v
    join public.costing_recipes r on r.id=v.recipe_id where r.recipe_kind='final_product'
    order by v.recipe_id,v.size_code,v.version_number desc
  loop
    select coalesce(jsonb_agg(jsonb_build_object('kind',component_kind,'id',coalesce(item_id,child_recipe_version_id),
      'quantity',quantity,'unit',unit,'placement',placement,'sort_order',sort_order) order by sort_order,id),'[]'::jsonb)
    into normalized from public.costing_recipe_components where recipe_version_id=previous.id;
    normalized := private.costing_required_cake_components(normalized);
    select max(version_number)+1 into next_number from public.costing_recipe_versions where recipe_id=previous.recipe_id;
    insert into public.costing_recipe_versions(recipe_id,version_number,version_status,yield_quantity,yield_unit,size_code,
      gross_weight,net_weight,active_minutes,passive_minutes,notes,change_reason)
    values(previous.recipe_id,next_number,'draft',previous.yield_quantity,previous.yield_unit,previous.size_code,
      previous.gross_weight,previous.net_weight,previous.active_minutes,previous.passive_minutes,previous.notes,
      'Proprietário: incluir Desmoldante formas 40 g e Irrigação 300 ml por torta em todas as fichas') returning id into next_id;
    for component in select value from jsonb_array_elements(normalized) loop
      insert into public.costing_recipe_components(recipe_version_id,component_kind,item_id,child_recipe_version_id,quantity,unit,placement,sort_order)
      values(next_id,component->>'kind',case when component->>'kind'='item' then (component->>'id')::uuid end,
        case when component->>'kind'='recipe_version' then (component->>'id')::uuid end,
        (component->>'quantity')::numeric,component->>'unit',component->>'placement',(component->>'sort_order')::integer);
    end loop;
    insert into public.costing_preparation_times(version_id,preparation_minutes,cooking_minutes,cooling_minutes)
    select next_id,preparation_minutes,cooking_minutes,cooling_minutes from public.costing_preparation_times where version_id=previous.id;
  end loop;
end;
$$;
commit;
