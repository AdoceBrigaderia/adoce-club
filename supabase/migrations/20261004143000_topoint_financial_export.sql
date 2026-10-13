-- Scoped server-to-server export. No customers, contacts or operational notes are exported.
create table private.topoint_export_grants (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table private.topoint_export_grants enable row level security;
revoke all on private.topoint_export_grants from public, anon, authenticated;

-- Reuse the authoritative management report, including audited cash corrections.
do $copy$
declare definition text;
begin
  select pg_get_functiondef('public.manager_management_report(date,date)'::regprocedure) into definition;
  definition := replace(definition,'public.manager_management_report','private.topoint_management_report');
  if position('if auth.uid() is null or not private.is_manager() then raise exception ''Acesso não autorizado''; end if;' in definition)=0 then
    raise exception 'Unexpected management report authorization';
  end if;
  definition := replace(definition,'if auth.uid() is null or not private.is_manager() then raise exception ''Acesso não autorizado''; end if;','');
  execute definition;
end $copy$;
revoke all on function private.topoint_management_report(date,date) from public,anon,authenticated;

-- Cost calculation remains inside Adoce and uses the invoice prices and recipe versions.
create function private.topoint_recipe_cost(version_id uuid, path uuid[] default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
declare component record; price record; child jsonb; child_version record; item record;
 total numeric:=0; missing jsonb:='[]'; amount numeric; source_quantity numeric; factor numeric; target_factor numeric; has_components boolean:=false;
begin
 if version_id=any(path) or cardinality(path)>40 then return jsonb_build_object('amount',null,'missing',jsonb_build_array('Dependência circular')); end if;
 for component in select * from public.costing_recipe_components where recipe_version_id=version_id order by sort_order loop
  has_components:=true;
  if component.quantity is null or component.quantity<=0 then missing:=missing||jsonb_build_array('Quantidade ausente'); continue; end if;
  factor:=case component.unit when 'kg' then 1000 when 'l' then 1000 else 1 end;
  if component.component_kind='item' then
   select * into item from public.costing_items where id=component.item_id and active;
   select p.* into price from public.costing_item_prices p
    where p.item_id=component.item_id and p.data_status<>'blocked' and p.purchase_price>0 and p.purchased_quantity>0
     and not exists(select 1 from public.costing_purchase_invoices i where i.id=p.source_invoice_id and (i.archived_at is not null or i.replaced_by is not null))
    order by p.effective_at desc,p.created_at desc limit 1;
   if item.id is null or price.id is null then missing:=missing||jsonb_build_array(coalesce(item.name,'Insumo')||': preço ausente'); continue; end if;
   if not ((component.unit in ('g','kg') and price.purchase_unit in ('g','kg')) or
       (component.unit in ('ml','l') and price.purchase_unit in ('ml','l')) or component.unit=price.purchase_unit) then
     missing:=missing||jsonb_build_array(item.name||': unidades incompatíveis'); continue;
   end if;
   target_factor:=case price.purchase_unit when 'kg' then 1000 when 'l' then 1000 else 1 end;
   source_quantity:=coalesce(price.useful_quantity,price.purchased_quantity)*target_factor;
   if source_quantity<=0 then missing:=missing||jsonb_build_array(item.name||': quantidade útil inválida'); continue; end if;
   amount:=round(price.purchase_price*component.quantity*factor/source_quantity,6);
  else
   child:=private.topoint_recipe_cost(component.child_recipe_version_id,path||version_id);
   select * into child_version from public.costing_recipe_versions where id=component.child_recipe_version_id;
   if child->>'amount' is null or child_version.yield_quantity is null or child_version.yield_quantity<=0 then
    missing:=missing||coalesce(child->'missing','[]')||jsonb_build_array('Preparação sem custo ou rendimento'); continue;
   end if;
   if not ((component.unit in ('g','kg') and child_version.yield_unit in ('g','kg')) or
       (component.unit in ('ml','l') and child_version.yield_unit in ('ml','l')) or component.unit=child_version.yield_unit) then
    missing:=missing||jsonb_build_array('Preparação: unidades incompatíveis'); continue;
   end if;
   target_factor:=case child_version.yield_unit when 'kg' then 1000 when 'l' then 1000 else 1 end;
   amount:=round((child->>'amount')::numeric*component.quantity*factor/(child_version.yield_quantity*target_factor),6);
  end if;
  total:=total+amount;
 end loop;
 if not has_components then missing:=missing||jsonb_build_array('Ficha sem componentes'); end if;
 return jsonb_build_object('amount',case when jsonb_array_length(missing)=0 then total else null end,'missing',missing);
end $fn$;
revoke all on function private.topoint_recipe_cost(uuid,uuid[]) from public,anon,authenticated;

create function public.topoint_financial_export(p_token text,p_start date,p_end date) returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
declare d date; report jsonb; flavor jsonb; recipe record; cost jsonb; flavors jsonb; days jsonb:='[]';
 total_cost numeric; covered integer; sold integer; unit_cost numeric; closed boolean;
begin
 if not exists(select 1 from private.topoint_export_grants where active and token_hash=encode(extensions.digest(p_token,'sha256'),'hex')) then
  raise exception 'Integração não autorizada' using errcode='42501';
 end if;
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>61 or p_end>(now() at time zone 'America/Fortaleza')::date then raise exception 'Período inválido'; end if;
 for d in select generate_series(p_start,p_end,'1 day')::date loop
  report:=private.topoint_management_report(d,d); flavors:='[]'; total_cost:=0; covered:=0; sold:=0;
  for flavor in select value from jsonb_array_elements(report->'flavors') loop
   select v.id,v.yield_quantity,v.yield_unit into recipe from public.costing_recipes r
    join public.flavors f on f.id=r.flavor_id join public.costing_recipe_versions v on v.recipe_id=r.id
    where r.active and r.recipe_kind='final_product' and v.size_code='G' and f.name=flavor->>'name'
    order by v.version_number desc limit 1;
   unit_cost:=null;
   if recipe.id is not null and recipe.yield_unit='slice' and recipe.yield_quantity>0 then
    cost:=private.topoint_recipe_cost(recipe.id);
    if cost->>'amount' is not null then unit_cost:=round((cost->>'amount')::numeric/recipe.yield_quantity,6); end if;
   else cost:=jsonb_build_object('missing',jsonb_build_array('Ficha G ou rendimento em fatias ausente')); end if;
   sold:=sold+coalesce((flavor->>'sold')::integer,0);
   if unit_cost is not null then total_cost:=total_cost+unit_cost*(flavor->>'sold')::integer; covered:=covered+(flavor->>'sold')::integer; end if;
   flavors:=flavors||jsonb_build_array(jsonb_build_object('name',flavor->>'name','sold',flavor->'sold','revenue',flavor->'revenue',
    'unit_cost',unit_cost,'cost',case when unit_cost is not null then round(unit_cost*(flavor->>'sold')::integer,2) else null end,
    'missing',coalesce(cost->'missing','[]'),'recipe_version_id',recipe.id));
  end loop;
  closed:=d<(now() at time zone 'America/Fortaleza')::date and not exists(select 1 from public.cash_sessions s where
    (s.opened_at at time zone 'America/Fortaleza')::date=d and s.status='open');
  days:=days||jsonb_build_array(jsonb_build_object('date',d,'closed',closed,'revenue',report#>'{kpis,revenue}',
   'slices',sold,'rewards',report#>'{kpis,rewards_count}','fees',report#>'{kpis,fees}',
   'expenses',report#>'{dre,expenses}','payments',report->'payments','flavors',flavors,
   'known_cost',round(total_cost,2),'cost_complete',covered=sold,'cost_coverage',case when sold=0 then 100 else round(100.0*covered/sold,1) end));
 end loop;
 return jsonb_build_object('source','adoce','exported_at',now(),'cost_basis','Fichas G e preços atuais das notas de compra; custo de ingredientes, sem gás, mão de obra ou entrega.','days',days);
end $fn$;
revoke all on function public.topoint_financial_export(text,date,date) from public;
grant execute on function public.topoint_financial_export(text,date,date) to anon,authenticated,service_role;
