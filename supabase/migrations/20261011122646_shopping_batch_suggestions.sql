-- Gerência confirma explicitamente os lotes; nunca substitui estoque existente.
create or replace function public.manager_get_shopping_day_suggestions(requested_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; week_plan jsonb; changed_at timestamptz;
begin
  if auth.uid() is null or not private.is_manager() then raise exception 'Acesso não autorizado'; end if;
  if requested_date is null then raise exception 'Informe a data'; end if;
  select plan, updated_at into week_plan, changed_at from private.costing_shopping_weeks
  where week_start = date_trunc('week', requested_date::timestamp)::date;
  with planned as (
    select split_part(e.key, '|', 2)::uuid flavor_id, e.value::text::numeric cakes
    from jsonb_each(coalesce(week_plan->'daily', '{}'::jsonb)) e
    where split_part(e.key, '|', 1) = requested_date::text and e.value::text::numeric > 0
  ), rows as (
    select p.*, f.name, f.active, v.yield_quantity, v.yield_unit,
      exists(select 1 from public.flavor_availability_batches b where b.flavor_id=p.flavor_id and b.service_date=requested_date and b.active)
      or exists(select 1 from public.flavor_availability a where a.flavor_id=p.flavor_id and a.service_date=requested_date and (a.quantity_available>0 or a.quantity_reserved>0)) has_existing_batch
    from planned p left join public.flavors f on f.id=p.flavor_id
    left join lateral (
      select rv.yield_quantity, rv.yield_unit from public.costing_recipes r
      join public.costing_recipe_versions rv on rv.recipe_id=r.id
      where r.flavor_id=p.flavor_id and r.active and r.recipe_kind='final_product' and rv.size_code='G'
      order by rv.version_number desc, rv.created_at desc, rv.id desc limit 1
    ) v on true
  ) select coalesce(jsonb_agg(jsonb_build_object(
    'flavor_id',flavor_id,'name',coalesce(name,'Sabor removido'),'cakes',cakes,
    'slices_per_cake',case when yield_unit='slice' and yield_quantity>0 and yield_quantity=trunc(yield_quantity) then yield_quantity else null end,
    'quantity',case when yield_unit='slice' and yield_quantity>0 and yield_quantity=trunc(yield_quantity) then cakes*yield_quantity else null end,
    'issue',case when active is distinct from true then 'Sabor indisponível'
      when cakes<>trunc(cakes) then 'Informe tortas inteiras no planejamento'
      when yield_unit is distinct from 'slice' or yield_quantity is null or yield_quantity<=0 or yield_quantity<>trunc(yield_quantity) then 'Ficha G sem rendimento inteiro em fatias'
      when cakes*yield_quantity>9999 then 'O lote excede 9.999 fatias' else null end,
    'has_existing_batch',has_existing_batch) order by flavor_id), '[]'::jsonb) into result from rows;
  return jsonb_build_object('items',result,'updated_at',changed_at);
end;
$$;

create or replace function public.manager_import_shopping_day_batches(
  requested_date date, requested_time time, chosen_flavor_ids uuid[], expected_items jsonb, expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare snapshot jsonb; item jsonb; chosen uuid; saved_count int:=0; skipped_count int:=0; current_items jsonb; old_items jsonb;
begin
  if auth.uid() is null or not private.is_manager() then raise exception 'Acesso não autorizado'; end if;
  if requested_date is null or requested_date < (now() at time zone 'America/Fortaleza')::date then raise exception 'Escolha hoje ou uma data futura'; end if;
  if requested_time is null then raise exception 'Informe o horário de liberação'; end if;
  if coalesce(cardinality(chosen_flavor_ids),0)=0 then raise exception 'Selecione ao menos um sabor'; end if;
  perform 1 from private.costing_shopping_weeks where week_start=date_trunc('week',requested_date::timestamp)::date for share;
  -- Inclui novas versões de ficha na proteção contra mudanças durante a confirmação.
  lock table public.costing_recipes, public.costing_recipe_versions in share mode;
  snapshot:=public.manager_get_shopping_day_suggestions(requested_date);
  select coalesce(jsonb_agg(e - 'has_existing_batch' order by e->>'flavor_id'),'[]') into current_items from jsonb_array_elements(snapshot->'items') e;
  select coalesce(jsonb_agg(e - 'has_existing_batch' order by e->>'flavor_id'),'[]') into old_items from jsonb_array_elements(expected_items) e;
  if (snapshot->>'updated_at')::timestamptz is distinct from expected_updated_at or current_items is distinct from old_items then
    raise exception 'O planejamento ou a ficha mudou. Atualize a prévia antes de criar lotes';
  end if;
  for chosen in select distinct unnest(chosen_flavor_ids) order by 1 loop
    select e into item from jsonb_array_elements(snapshot->'items') e where e->>'flavor_id'=chosen::text;
    if item is null or item->>'issue' is not null or (item->>'quantity')::numeric is null then raise exception 'Sugestão inválida. Atualize o planejamento'; end if;
    insert into public.flavor_availability(flavor_id,service_date,status,quantity_available,quantity_reserved,pickup_release,updated_by)
    values(chosen,requested_date,'available',0,0,'now',auth.uid()) on conflict(flavor_id,service_date) do nothing;
    perform 1 from public.flavor_availability where flavor_id=chosen and service_date=requested_date for update;
    if exists(select 1 from public.flavor_availability_batches where flavor_id=chosen and service_date=requested_date and active)
      or exists(select 1 from public.flavor_availability where flavor_id=chosen and service_date=requested_date and (quantity_available>0 or quantity_reserved>0))
      -- Mesmo lote inativo não pode ser reativado/substituído pelo importador.
      or exists(select 1 from public.flavor_availability_batches where flavor_id=chosen and service_date=requested_date and available_from=requested_time) then
      skipped_count:=skipped_count+1; continue;
    end if;
    perform public.staff_upsert_flavor_availability_batch(null,chosen,requested_date,requested_time,(item->>'quantity')::numeric::integer);
    saved_count:=saved_count+1;
  end loop;
  return jsonb_build_object('created',saved_count,'skipped',skipped_count);
end;
$$;
revoke all on function public.manager_get_shopping_day_suggestions(date) from public, anon;
revoke all on function public.manager_import_shopping_day_batches(date,time,uuid[],jsonb,timestamptz) from public, anon;
grant execute on function public.manager_get_shopping_day_suggestions(date) to authenticated;
grant execute on function public.manager_import_shopping_day_batches(date,time,uuid[],jsonb,timestamptz) to authenticated;
