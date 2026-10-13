create or replace function public.manager_update_shopping_week(requested_week date,requested_group text,requested_key text,requested_value jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved jsonb; amount numeric; flavor uuid; day_date date; previous numeric; unassigned numeric; entry jsonb;
begin
 if not coalesce(private.is_manager(),false) then raise exception 'Acesso restrito à gestão'; end if;
 if requested_week is null or extract(isodow from requested_week)<>1 then raise exception 'Escolha uma semana válida'; end if;
 if requested_group is null or requested_group not in ('cakes','daily','extras','stock','selected','quoteUnits','quoteWeight','quotePrice','inCart','procurement') or requested_key is null then raise exception 'Campo inválido'; end if;
 if requested_group='daily' then
  if requested_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[|][a-fA-F0-9-]{36}$' then raise exception 'Dia inválido'; end if;
  day_date:=split_part(requested_key,'|',1)::date;
  if day_date<requested_week or day_date>requested_week+6 then raise exception 'Dia fora da semana'; end if;
  flavor:=split_part(requested_key,'|',2)::uuid;
 else
  if requested_key !~ '^[a-fA-F0-9-]{36}$' then raise exception 'Campo inválido'; end if;
  flavor:=requested_key::uuid;
 end if;
 if requested_group in ('selected','inCart') then
  if jsonb_typeof(requested_value) is distinct from 'boolean' then raise exception 'Seleção inválida'; end if;
 elsif requested_group='procurement' then
  if jsonb_typeof(requested_value) is distinct from 'object' or jsonb_typeof(coalesce(requested_value->'offers','[]')) is distinct from 'array' or jsonb_typeof(coalesce(requested_value->'purchases','[]')) is distinct from 'array' or jsonb_array_length(coalesce(requested_value->'offers','[]'))>3 or jsonb_array_length(coalesce(requested_value->'purchases','[]'))>20 then raise exception 'Dados de compra inválidos'; end if;
  for entry in select value from jsonb_array_elements(coalesce(requested_value->'offers','[]')||coalesce(requested_value->'purchases','[]')) loop
   if coalesce(entry->>'id','')='' or (coalesce(entry->>'supplierId','')<>'' and (coalesce(entry->>'supplierId','') !~ '^[a-fA-F0-9-]{36}$' or not exists(select 1 from public.costing_suppliers s where s.id=(entry->>'supplierId')::uuid))) or jsonb_typeof(entry->'packages') is distinct from 'number' or jsonb_typeof(entry->'contentPerPackage') is distinct from 'number' or jsonb_typeof(entry->'totalPrice') is distinct from 'number' or (entry->>'packages')::numeric<=0 or (entry->>'packages')::numeric>1000000 or (entry->>'contentPerPackage')::numeric<=0 or (entry->>'contentPerPackage')::numeric>1000000000 or (entry->>'totalPrice')::numeric<0 or (entry->>'totalPrice')::numeric>1000000000 then raise exception 'Cotação ou compra inválida'; end if;
  end loop;
 else
  if jsonb_typeof(requested_value) is distinct from 'number' then raise exception 'Quantidade inválida'; end if;
  amount:=requested_value::text::numeric;
  if amount<0 or amount>1000000000 or (requested_group in ('daily','cakes','quoteUnits') and amount<>trunc(amount)) then raise exception 'Quantidade inválida'; end if;
 end if;
 if requested_group='daily' and amount>1 then raise exception 'Selecione somente uma torta por sabor e dia'; end if;
 if requested_group in ('daily','cakes') then
  if not exists(select 1 from public.flavors where id=flavor) then raise exception 'Sabor inexistente'; end if;
 else
  if not exists(select 1 from public.costing_items where id=flavor) then raise exception 'Item inexistente'; end if;
 end if;
 insert into private.costing_shopping_weeks(week_start) values(requested_week) on conflict do nothing;
 select plan into saved from private.costing_shopping_weeks where week_start=requested_week for update;
 if requested_group='daily' then previous:=coalesce((saved->'daily'->>requested_key)::numeric,0);unassigned:=greatest(0,coalesce((saved->'cakes'->>flavor::text)::numeric,0)-greatest(0,amount-previous));saved:=jsonb_set(saved,array['cakes',flavor::text],to_jsonb(unassigned),true);end if;
 saved:=jsonb_set(saved,array[requested_group],coalesce(saved->requested_group,'{}'::jsonb),true);
 saved:=jsonb_set(saved,array[requested_group,requested_key],requested_value,true);
 update private.costing_shopping_weeks set plan=saved,updated_at=clock_timestamp(),updated_by=auth.uid() where week_start=requested_week;
 return saved;
end;$$;

create or replace function public.manager_copy_shopping_week(source_week date,target_week date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare source_plan jsonb; copied jsonb; daily jsonb; entry record;
begin
 if not coalesce(private.is_manager(),false) then raise exception 'Acesso restrito à gestão'; end if;
 if source_week is null or target_week is null or extract(isodow from source_week)<>1 or extract(isodow from target_week)<>1 or source_week=target_week then raise exception 'Escolha semanas diferentes'; end if;
 select plan into source_plan from private.costing_shopping_weeks where week_start=source_week;
 if source_plan is null then raise exception 'A semana anterior ainda não tem planejamento'; end if;
 daily:='{}'::jsonb;
 for entry in select key,value from jsonb_each(source_plan->'daily') loop daily:=daily||jsonb_build_object((split_part(entry.key,'|',1)::date+(target_week-source_week))::text||'|'||split_part(entry.key,'|',2),entry.value);end loop;
 copied:=source_plan||jsonb_build_object('daily',daily,'stock','{}'::jsonb,'inCart','{}'::jsonb,'procurement','{}'::jsonb);
 insert into private.costing_shopping_weeks(week_start,plan,updated_by) values(target_week,copied,auth.uid()) on conflict do nothing;
 if not found then raise exception 'Esta semana já tem um planejamento salvo. Ele foi preservado'; end if;
 return copied;
end;$$;

revoke all on function public.manager_update_shopping_week(date,text,text,jsonb) from public,anon;
revoke all on function public.manager_copy_shopping_week(date,date) from public,anon;
grant execute on function public.manager_update_shopping_week(date,text,text,jsonb) to authenticated;
grant execute on function public.manager_copy_shopping_week(date,date) to authenticated;
