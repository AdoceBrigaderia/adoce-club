-- Keep corrected invoices and their prices as immutable history.
alter table public.costing_purchase_invoices add column archived_at timestamptz;
alter table public.costing_purchase_invoices add column replaced_by uuid references public.costing_purchase_invoices(id);
alter table public.costing_item_prices add column source_invoice_id uuid references public.costing_purchase_invoices(id);
update public.costing_item_prices p set source_invoice_id=l.invoice_id from public.costing_purchase_invoice_lines l where l.price_id=p.id;
create table private.costing_catalog_edit_audit (
 id bigint generated always as identity primary key, entity_kind text not null,
 entity_id uuid not null, before_data jsonb not null, after_data jsonb not null,
 actor_id uuid not null, created_at timestamptz not null default now()
);
alter table private.costing_catalog_edit_audit enable row level security;
revoke all on private.costing_catalog_edit_audit from public,anon,authenticated;

create or replace function private.link_cost_price_invoice() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.costing_item_prices set source_invoice_id=new.invoice_id where id=new.price_id; return new; end $$;
revoke all on function private.link_cost_price_invoice() from public,anon,authenticated;
create trigger link_cost_price_invoice after insert on public.costing_purchase_invoice_lines for each row execute function private.link_cost_price_invoice();

create or replace function public.manager_edit_costing_purchase_invoice(
 target_invoice_id uuid, expected_invoice jsonb, next_supplier_name text,
 next_invoice_number text, next_series text, next_issued_on date,
 next_discount_total numeric, next_freight_total numeric, next_notes text, next_lines jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.costing_purchase_invoices; saved jsonb;
begin
 if not private.is_manager() then raise exception 'Acesso negado'; end if;
 select * into existing from public.costing_purchase_invoices where id=target_invoice_id for update;
 if existing.id is null then raise exception 'Nota não encontrada'; end if;
 if existing.archived_at is not null then raise exception 'Esta nota foi excluída. Restaure antes de editar.'; end if;
 if existing.replaced_by is not null then raise exception 'Esta nota já foi corrigida. Atualize a lista antes de editar.'; end if;
 if expected_invoice is distinct from (select value from jsonb_array_elements(public.manager_get_costing_purchase_workspace()) value where value->>'id'=target_invoice_id::text) then raise exception 'Esta nota foi alterada. Atualize e abra a edição novamente.'; end if;
 saved:=public.manager_save_costing_purchase_invoice_v2(next_supplier_name,next_invoice_number,next_series,next_issued_on,next_discount_total,next_freight_total,next_notes,next_lines);
 update public.costing_purchase_invoices set replaced_by=(saved->>'id')::uuid where id=target_invoice_id;
 insert into private.costing_catalog_edit_audit(entity_kind,entity_id,before_data,after_data,actor_id) values('invoice',target_invoice_id,expected_invoice,saved,auth.uid());
 return saved;
end $$;
revoke all on function public.manager_edit_costing_purchase_invoice(uuid,jsonb,text,text,text,date,numeric,numeric,text,jsonb) from public,anon;
grant execute on function public.manager_edit_costing_purchase_invoice(uuid,jsonb,text,text,text,date,numeric,numeric,text,jsonb) to authenticated;

create or replace function public.manager_edit_costing_purchase_catalog(
 target_kind text,target_id uuid,expected_data jsonb,next_data jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare previous jsonb; saved jsonb; name_value text:=btrim(next_data->>'name');
begin
 if not private.is_manager() then raise exception 'Acesso negado'; end if;
 if coalesce(name_value,'')='' or length(name_value)>(case when target_kind='supplier' then 160 when target_kind='package' then 40 else 80 end) then raise exception 'Informe um nome de até 80 caracteres'; end if;
 if target_kind='supplier' then
  select to_jsonb(s) into previous from public.costing_suppliers s where id=target_id for update;
 elsif target_kind='package' then
  select to_jsonb(s) into previous from public.costing_package_types s where id=target_id for update;
 elsif target_kind='content' then
  select to_jsonb(s) into previous from public.costing_content_units s where id=target_id for update;
 else raise exception 'Cadastro inválido'; end if;
 if previous is null then raise exception 'Cadastro não encontrado'; end if;
 if previous->>'name' is distinct from expected_data->>'name' or (target_kind='content' and ((previous->>'physical_quantity')::numeric is distinct from (expected_data->>'physical_quantity')::numeric or previous->>'physical_unit' is distinct from expected_data->>'physical_unit')) then raise exception 'Cadastro alterado. Atualize a lista e tente novamente.'; end if;
 if target_kind='supplier' then
  update public.costing_suppliers set name=name_value where id=target_id returning to_jsonb(costing_suppliers.*) into saved;
 elsif target_kind='package' then
  update public.costing_package_types set name=name_value where id=target_id returning to_jsonb(costing_package_types.*) into saved;
 else
  if coalesce((next_data->>'physical_quantity')::numeric,0)<=0 or (next_data->>'physical_quantity')::numeric>999999999 or coalesce(next_data->>'physical_unit','') not in ('g','kg','ml','l','unit') then raise exception 'Conteúdo ou unidade inválidos'; end if;
  update public.costing_content_units set name=name_value,physical_quantity=(next_data->>'physical_quantity')::numeric,physical_unit=next_data->>'physical_unit' where id=target_id returning to_jsonb(costing_content_units.*) into saved;
 end if;
 insert into private.costing_catalog_edit_audit(entity_kind,entity_id,before_data,after_data,actor_id) values(target_kind,target_id,previous,saved,auth.uid());
end $$;
revoke all on function public.manager_edit_costing_purchase_catalog(text,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.manager_edit_costing_purchase_catalog(text,uuid,jsonb,jsonb) to authenticated;

create or replace function public.manager_get_costing_invoice_revisions(target_invoice_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_manager() then raise exception 'Acesso negado'; end if;
 return coalesce((with recursive revisions as (
 select i.* from public.costing_purchase_invoices i where i.replaced_by=target_invoice_id
 union all select i.* from public.costing_purchase_invoices i join revisions r on i.replaced_by=r.id
 ) select jsonb_agg(to_jsonb(r)||jsonb_build_object('lines',(select jsonb_agg(to_jsonb(l)||jsonb_build_object('item_name',i.name)) from public.costing_purchase_invoice_lines l join public.costing_items i on i.id=l.item_id where invoice_id=r.id)) order by r.created_at desc) from revisions r),'[]'::jsonb);
end $$;
revoke all on function public.manager_get_costing_invoice_revisions(uuid) from public,anon;
grant execute on function public.manager_get_costing_invoice_revisions(uuid) to authenticated;
CREATE OR REPLACE FUNCTION private.costing_commercial_item_json(target_item_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', item.id,
    'internal_code', item.internal_code,
    'name', item.name,
    'item_kind', item.item_kind,
    'category', item.category,
    'brand', item.brand,
    'supplier', item.supplier,
    'purchase_unit', item.purchase_unit,
    'package_quantity', item.package_quantity,
    'consumption_unit', item.consumption_unit,
    'default_loss_percent', item.default_loss_percent,
    'data_status', item.data_status,
    'active', item.active,
    'cost_origin', commercial.cost_origin,
    'manual_unit_cost', commercial.manual_unit_cost,
    'effective_unit_cost', private.costing_effective_unit_cost(item.id),
    'sale_price', commercial.sale_price,
    'gross_profit', round(commercial.sale_price - private.costing_effective_unit_cost(item.id), 4),
    'margin', case
      when commercial.sale_price > 0 then round((commercial.sale_price - private.costing_effective_unit_cost(item.id)) / commercial.sale_price, 6)
      else 0
    end,
    'markup', case
      when private.costing_effective_unit_cost(item.id) > 0 then round(commercial.sale_price / private.costing_effective_unit_cost(item.id), 6)
      else 0
    end,
    'minimum_margin', commercial.minimum_margin,
    'margin_alert', commercial.sale_price > 0 and (
      (commercial.sale_price - private.costing_effective_unit_cost(item.id)) / commercial.sale_price
    ) < commercial.minimum_margin,
    'acquisition_cost', commercial.acquisition_cost,
    'expected_uses', commercial.expected_uses,
    'maintenance_per_use', commercial.maintenance_per_use,
    'cleaning_per_use', commercial.cleaning_per_use,
    'replacement_reserve_per_use', commercial.replacement_reserve_per_use,
    'commercial_status', commercial.commercial_status,
    'notes', commercial.notes,
    'latest_purchase_price', coalesce((
      select jsonb_build_object(
        'id', price.id,
        'purchase_price', price.purchase_price,
        'purchased_quantity', price.purchased_quantity,
        'purchase_unit', price.purchase_unit,
        'useful_quantity', price.useful_quantity,
        'gross_unit_cost', price.gross_unit_cost,
        'net_unit_cost', price.net_unit_cost,
        'effective_at', price.effective_at,
        'data_status', price.data_status,
        'source_note', price.source_note
      )
      from public.costing_item_prices price
      where price.item_id = item.id and not exists (select 1 from public.costing_purchase_invoices archived where archived.id=price.source_invoice_id and (archived.replaced_by is not null or archived.archived_at is not null))
      order by price.effective_at desc, price.created_at desc
      limit 1
    ), 'null'::jsonb),
    'updated_at', greatest(item.updated_at, commercial.updated_at)
  )
  from public.costing_items item
  join public.costing_item_commercial_settings commercial on commercial.item_id = item.id
  where item.id = target_item_id;
$function$;
CREATE OR REPLACE FUNCTION private.costing_consolidate_invoice_item_prices()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare combined record;
begin
  for combined in
    select line.item_id, line.normalized_unit, sum(line.net_total) as net_total,
      sum(line.normalized_quantity) as purchased_quantity,
      case when bool_and(price.data_status = 'validated') then sum(line.useful_quantity) else null end as useful_quantity,
      bool_and(price.data_status = 'validated') as checked
    from public.costing_purchase_invoice_lines line
    join public.costing_item_prices price on price.id = line.price_id
    where line.invoice_id = new.id
    group by line.item_id, line.normalized_unit
    having count(*) > 1
  loop
    insert into public.costing_item_prices (
      item_id, purchase_price, purchased_quantity, purchase_unit, useful_quantity,
      effective_at, data_status, source_note, created_by, created_at, source_invoice_id
    ) values (
      combined.item_id, combined.net_total, combined.purchased_quantity,
      combined.normalized_unit, combined.useful_quantity, new.issued_on::timestamptz,
      case when combined.checked then 'validated' else 'provisional' end,
      'Nota ' || new.invoice_number || case when new.series <> '' then '/' || new.series else '' end ||
      ' · ' || new.supplier_name || ' · conjunto de apresentações',
      new.created_by, clock_timestamp(), new.id
    );
  end loop;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.manager_get_costing_purchase_workspace()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem consultar notas de custo'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', inv.id, 'supplier_id', inv.supplier_id, 'supplier_name', inv.supplier_name, 'invoice_number', inv.invoice_number,
    'series', inv.series, 'issued_on', inv.issued_on, 'subtotal', inv.subtotal,
    'discount_total', inv.discount_total, 'freight_total', inv.freight_total,
    'notes', inv.notes, 'total_cost', inv.total_cost, 'created_at', inv.created_at,
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
      'id', purchase_line.id, 'line_number', purchase_line.line_number, 'item_id', purchase_line.item_id,
      'item_name', item.name, 'package_layers', purchase_line.package_layers,
      'content_quantity', purchase_line.content_quantity, 'content_unit', purchase_line.content_unit,
      'entered_content_quantity', purchase_line.entered_content_quantity,
      'content_unit_catalog_id', purchase_line.content_unit_catalog_id, 'content_presentation', content_unit.name,
      'outer_unit_price', purchase_line.outer_unit_price,
      'brand_name', purchase_line.brand_name, 'item_notes', purchase_line.item_notes,
      'normalized_quantity', purchase_line.normalized_quantity, 'normalized_unit', purchase_line.normalized_unit,
      'useful_quantity', purchase_line.useful_quantity, 'gross_total', purchase_line.gross_total,
      'allocated_discount', purchase_line.allocated_discount, 'allocated_freight', purchase_line.allocated_freight,
      'net_total', purchase_line.net_total
    ) order by purchase_line.line_number) from public.costing_purchase_invoice_lines purchase_line
      join public.costing_items item on item.id = purchase_line.item_id
      left join public.costing_content_units content_unit on content_unit.id = purchase_line.content_unit_catalog_id
      where purchase_line.invoice_id = inv.id), '[]'::jsonb)
  ) order by inv.issued_on desc, inv.created_at desc)
  from public.costing_purchase_invoices inv where inv.replaced_by is null and inv.archived_at is null), '[]'::jsonb);
end;
$function$;
CREATE OR REPLACE FUNCTION public.manager_get_costing_technical_workspace()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION private.costing_latest_purchase_unit_cost(target_item_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((
    select price.net_unit_cost
    from public.costing_item_prices price
    where price.item_id = target_item_id and not exists (select 1 from public.costing_purchase_invoices archived where archived.id=price.source_invoice_id and (archived.replaced_by is not null or archived.archived_at is not null))
      and price.data_status <> 'blocked'
    order by
      case price.data_status when 'validated' then 0 when 'awaiting_validation' then 1 else 2 end,
      price.effective_at desc,
      price.created_at desc
    limit 1
  ), 0)::numeric;
$function$;
CREATE OR REPLACE FUNCTION public.manager_get_costing_suppliers()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem consultar fornecedores'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', supplier.id, 'name', supplier.name,
    'invoice_count', (select count(*) from public.costing_purchase_invoices invoice where invoice.supplier_id = supplier.id and invoice.replaced_by is null and invoice.archived_at is null),
    'last_purchase', (select max(invoice.issued_on) from public.costing_purchase_invoices invoice where invoice.supplier_id = supplier.id and invoice.replaced_by is null and invoice.archived_at is null)
  ) order by supplier.name) from public.costing_suppliers supplier), '[]'::jsonb);
end;
$function$;
create or replace function public.manager_archive_costing_record(
 target_kind text,target_id uuid,next_archive boolean,next_reason text
) returns void language plpgsql security definer set search_path='' as $$
declare previous jsonb; saved jsonb;
begin
 if not private.is_manager() then raise exception 'Acesso negado'; end if;
 if next_archive is null or length(btrim(coalesce(next_reason,''))) not between 3 and 500 then raise exception 'Informe o motivo da alteração'; end if;
 if target_kind='invoice' then
  select to_jsonb(i) into previous from public.costing_purchase_invoices i where id=target_id for update;
  if previous is null then raise exception 'Nota não encontrada'; end if;
  if previous->>'replaced_by' is not null then raise exception 'Esta versão foi substituída por uma correção. Use a nota atual.'; end if;
  update public.costing_purchase_invoices set archived_at=case when next_archive then now() else null end where id=target_id returning to_jsonb(costing_purchase_invoices.*) into saved;
 elsif target_kind='item' then
  select to_jsonb(i) into previous from public.costing_items i where id=target_id for update;
  if previous is null then raise exception 'Produto não encontrado'; end if;
  update public.costing_items set active=not next_archive,updated_at=now(),updated_by=auth.uid() where id=target_id returning to_jsonb(costing_items.*) into saved;
 else raise exception 'Tipo de cadastro inválido'; end if;
 insert into private.costing_catalog_edit_audit(entity_kind,entity_id,before_data,after_data,actor_id) values(target_kind,target_id,previous,saved||jsonb_build_object('reason',next_reason),auth.uid());
end $$;
revoke all on function public.manager_archive_costing_record(text,uuid,boolean,text) from public,anon;
grant execute on function public.manager_archive_costing_record(text,uuid,boolean,text) to authenticated;

create or replace function public.manager_get_archived_costing_invoices() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_manager() then raise exception 'Acesso negado'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'invoice_number',i.invoice_number,'supplier_name',i.supplier_name,'issued_on',i.issued_on,'total_cost',i.total_cost,'archived_at',i.archived_at) order by i.archived_at desc) from public.costing_purchase_invoices i where i.archived_at is not null and i.replaced_by is null),'[]'::jsonb);
end $$;
revoke all on function public.manager_get_archived_costing_invoices() from public,anon;
grant execute on function public.manager_get_archived_costing_invoices() to authenticated;
