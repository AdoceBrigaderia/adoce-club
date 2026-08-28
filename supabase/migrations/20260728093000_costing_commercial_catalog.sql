begin;

create table if not exists public.costing_item_commercial_settings (
  item_id uuid primary key references public.costing_items(id) on delete cascade,
  cost_origin text not null default 'manual_provisional' check (
    cost_origin in ('manufactured', 'purchased', 'asset', 'service', 'manual_provisional')
  ),
  manual_unit_cost numeric(14,4) not null default 0 check (manual_unit_cost >= 0),
  sale_price numeric(14,2) not null default 0 check (sale_price >= 0),
  minimum_margin numeric(9,6) not null default 0 check (minimum_margin between 0 and 0.999999),
  acquisition_cost numeric(14,4) not null default 0 check (acquisition_cost >= 0),
  expected_uses numeric(16,4) not null default 1 check (expected_uses > 0),
  maintenance_per_use numeric(14,4) not null default 0 check (maintenance_per_use >= 0),
  cleaning_per_use numeric(14,4) not null default 0 check (cleaning_per_use >= 0),
  replacement_reserve_per_use numeric(14,4) not null default 0 check (replacement_reserve_per_use >= 0),
  commercial_status text not null default 'draft' check (
    commercial_status in ('draft', 'internal', 'selected_customers', 'public', 'blocked')
  ),
  notes text not null default '' check (length(notes) <= 2000),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.costing_item_commercial_settings(item_id)
select item.id
from public.costing_items item
on conflict (item_id) do nothing;

alter table public.costing_item_commercial_settings enable row level security;
revoke all on public.costing_item_commercial_settings from public, anon, authenticated;
grant all on public.costing_item_commercial_settings to service_role;

create index if not exists costing_item_commercial_origin_status_idx
  on public.costing_item_commercial_settings (cost_origin, commercial_status);

create or replace function private.costing_latest_purchase_unit_cost(target_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select price.net_unit_cost
    from public.costing_item_prices price
    where price.item_id = target_item_id
      and price.data_status <> 'blocked'
    order by
      case price.data_status when 'validated' then 0 when 'awaiting_validation' then 1 else 2 end,
      price.effective_at desc,
      price.created_at desc
    limit 1
  ), 0)::numeric;
$$;

create or replace function private.costing_effective_unit_cost(target_item_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  settings public.costing_item_commercial_settings%rowtype;
  purchase_cost numeric := 0;
begin
  select * into settings
  from public.costing_item_commercial_settings commercial
  where commercial.item_id = target_item_id;

  if settings.item_id is null then
    return 0;
  end if;

  purchase_cost := private.costing_latest_purchase_unit_cost(target_item_id);

  if settings.cost_origin = 'purchased' and purchase_cost > 0 then
    return round(purchase_cost, 4);
  end if;

  if settings.cost_origin = 'asset' then
    return round(
      (settings.acquisition_cost / settings.expected_uses) +
      settings.maintenance_per_use +
      settings.cleaning_per_use +
      settings.replacement_reserve_per_use,
      4
    );
  end if;

  return round(settings.manual_unit_cost, 4);
end;
$$;

create or replace function private.costing_commercial_item_json(target_item_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
      where price.item_id = item.id
      order by price.effective_at desc, price.created_at desc
      limit 1
    ), 'null'::jsonb),
    'updated_at', greatest(item.updated_at, commercial.updated_at)
  )
  from public.costing_items item
  join public.costing_item_commercial_settings commercial on commercial.item_id = item.id
  where item.id = target_item_id;
$$;

create or replace function public.manager_get_costing_catalog_workspace(
  search_text text default null,
  requested_item_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selected_item_id uuid;
  normalized_search text := lower(btrim(coalesce(search_text, '')));
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem acessar custos e margens';
  end if;

  if requested_item_id is not null and exists (
    select 1 from public.costing_items item where item.id = requested_item_id
  ) then
    selected_item_id := requested_item_id;
  else
    select item.id into selected_item_id
    from public.costing_items item
    join public.costing_item_commercial_settings commercial on commercial.item_id = item.id
    where normalized_search = ''
      or lower(item.name) like '%' || normalized_search || '%'
      or lower(item.internal_code) like '%' || normalized_search || '%'
      or lower(item.category) like '%' || normalized_search || '%'
    order by
      item.active desc,
      (
        commercial.sale_price > 0 and
        ((commercial.sale_price - private.costing_effective_unit_cost(item.id)) / commercial.sale_price) < commercial.minimum_margin
      ) desc,
      item.name
    limit 1;
  end if;

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(private.costing_commercial_item_json(item.id) order by item.active desc, item.name)
      from public.costing_items item
      join public.costing_item_commercial_settings commercial on commercial.item_id = item.id
      where normalized_search = ''
        or lower(item.name) like '%' || normalized_search || '%'
        or lower(item.internal_code) like '%' || normalized_search || '%'
        or lower(item.category) like '%' || normalized_search || '%'
    ), '[]'::jsonb),
    'selected_item_id', selected_item_id,
    'selected_item', case when selected_item_id is null then null else private.costing_commercial_item_json(selected_item_id) end,
    'summary', jsonb_build_object(
      'total_items', (select count(*) from public.costing_item_commercial_settings),
      'public_items', (select count(*) from public.costing_item_commercial_settings where commercial_status = 'public'),
      'margin_alerts', (
        select count(*)
        from public.costing_item_commercial_settings commercial
        where commercial.sale_price > 0
          and ((commercial.sale_price - private.costing_effective_unit_cost(commercial.item_id)) / commercial.sale_price) < commercial.minimum_margin
      ),
      'provisional_costs', (
        select count(*)
        from public.costing_item_commercial_settings commercial
        join public.costing_items item on item.id = commercial.item_id
        where commercial.cost_origin = 'manual_provisional'
          or item.data_status in ('provisional', 'awaiting_validation')
      )
    )
  );
end;
$$;

create or replace function public.manager_save_costing_catalog_item(
  target_item_id uuid default null,
  next_internal_code text default null,
  next_name text default null,
  next_item_kind text default 'other',
  next_category text default '',
  next_brand text default '',
  next_supplier text default '',
  next_purchase_unit text default 'unit',
  next_package_quantity numeric default 1,
  next_consumption_unit text default 'unit',
  next_default_loss_percent numeric default 0,
  next_data_status text default 'provisional',
  next_active boolean default true,
  next_cost_origin text default 'manual_provisional',
  next_manual_unit_cost numeric default 0,
  next_sale_price numeric default 0,
  next_minimum_margin numeric default 0,
  next_acquisition_cost numeric default 0,
  next_expected_uses numeric default 1,
  next_maintenance_per_use numeric default 0,
  next_cleaning_per_use numeric default 0,
  next_replacement_reserve_per_use numeric default 0,
  next_commercial_status text default 'draft',
  next_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_item_id uuid;
  normalized_code text := upper(btrim(coalesce(next_internal_code, '')));
  normalized_name text := left(btrim(coalesce(next_name, '')), 160);
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem alterar custos e margens';
  end if;
  if normalized_code !~ '^[A-Z0-9][A-Z0-9._-]{0,39}$' then raise exception 'Código interno inválido'; end if;
  if normalized_name = '' then raise exception 'Informe o nome do item'; end if;
  if next_item_kind not in ('ingredient', 'packaging', 'utility', 'labor', 'equipment', 'service', 'other') then raise exception 'Tipo de item inválido'; end if;
  if next_purchase_unit not in ('g', 'kg', 'ml', 'l', 'unit', 'package', 'box', 'can', 'tray', 'hour', 'kwh', 'other') then raise exception 'Unidade de compra inválida'; end if;
  if next_consumption_unit not in ('g', 'kg', 'ml', 'l', 'unit', 'package', 'box', 'can', 'tray', 'hour', 'kwh', 'other') then raise exception 'Unidade de consumo inválida'; end if;
  if next_data_status not in ('provisional', 'awaiting_validation', 'validated', 'blocked') then raise exception 'Status técnico inválido'; end if;
  if next_cost_origin not in ('manufactured', 'purchased', 'asset', 'service', 'manual_provisional') then raise exception 'Origem do custo inválida'; end if;
  if next_commercial_status not in ('draft', 'internal', 'selected_customers', 'public', 'blocked') then raise exception 'Status comercial inválido'; end if;
  if coalesce(next_package_quantity, 0) <= 0 then raise exception 'Quantidade da embalagem inválida'; end if;
  if coalesce(next_expected_uses, 0) <= 0 then raise exception 'Quantidade de usos inválida'; end if;
  if coalesce(next_default_loss_percent, 0) not between 0 and 99.9999 then raise exception 'Percentual de perda inválido'; end if;
  if coalesce(next_minimum_margin, 0) not between 0 and 0.999999 then raise exception 'Margem mínima inválida'; end if;

  if target_item_id is null then
    insert into public.costing_items(
      internal_code, name, item_kind, category, brand, supplier,
      purchase_unit, package_quantity, consumption_unit,
      default_loss_percent, data_status, active, created_by, updated_by
    ) values (
      normalized_code, normalized_name, next_item_kind,
      left(btrim(coalesce(next_category, '')), 120),
      left(btrim(coalesce(next_brand, '')), 120),
      left(btrim(coalesce(next_supplier, '')), 160),
      next_purchase_unit, next_package_quantity, next_consumption_unit,
      next_default_loss_percent, next_data_status, coalesce(next_active, true),
      (select auth.uid()), (select auth.uid())
    ) returning id into saved_item_id;
  else
    update public.costing_items item set
      internal_code = normalized_code,
      name = normalized_name,
      item_kind = next_item_kind,
      category = left(btrim(coalesce(next_category, '')), 120),
      brand = left(btrim(coalesce(next_brand, '')), 120),
      supplier = left(btrim(coalesce(next_supplier, '')), 160),
      purchase_unit = next_purchase_unit,
      package_quantity = next_package_quantity,
      consumption_unit = next_consumption_unit,
      default_loss_percent = next_default_loss_percent,
      data_status = next_data_status,
      active = coalesce(next_active, true),
      updated_by = (select auth.uid()),
      updated_at = now()
    where item.id = target_item_id
    returning item.id into saved_item_id;
    if saved_item_id is null then raise exception 'Item não encontrado'; end if;
  end if;

  insert into public.costing_item_commercial_settings(
    item_id, cost_origin, manual_unit_cost, sale_price, minimum_margin,
    acquisition_cost, expected_uses, maintenance_per_use, cleaning_per_use,
    replacement_reserve_per_use, commercial_status, notes, created_by, updated_by
  ) values (
    saved_item_id, next_cost_origin, greatest(coalesce(next_manual_unit_cost, 0), 0),
    greatest(coalesce(next_sale_price, 0), 0), coalesce(next_minimum_margin, 0),
    greatest(coalesce(next_acquisition_cost, 0), 0), next_expected_uses,
    greatest(coalesce(next_maintenance_per_use, 0), 0),
    greatest(coalesce(next_cleaning_per_use, 0), 0),
    greatest(coalesce(next_replacement_reserve_per_use, 0), 0),
    next_commercial_status, left(btrim(coalesce(next_notes, '')), 2000),
    (select auth.uid()), (select auth.uid())
  )
  on conflict (item_id) do update set
    cost_origin = excluded.cost_origin,
    manual_unit_cost = excluded.manual_unit_cost,
    sale_price = excluded.sale_price,
    minimum_margin = excluded.minimum_margin,
    acquisition_cost = excluded.acquisition_cost,
    expected_uses = excluded.expected_uses,
    maintenance_per_use = excluded.maintenance_per_use,
    cleaning_per_use = excluded.cleaning_per_use,
    replacement_reserve_per_use = excluded.replacement_reserve_per_use,
    commercial_status = excluded.commercial_status,
    notes = excluded.notes,
    updated_by = (select auth.uid()),
    updated_at = now();

  return public.manager_get_costing_catalog_workspace(null, saved_item_id);
end;
$$;

create or replace function public.manager_add_costing_item_price(
  target_item_id uuid,
  next_purchase_price numeric,
  next_purchased_quantity numeric,
  next_purchase_unit text,
  next_useful_quantity numeric default null,
  next_effective_at timestamptz default now(),
  next_data_status text default 'provisional',
  next_source_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem registrar preços de compra';
  end if;
  if not exists (select 1 from public.costing_items item where item.id = target_item_id) then raise exception 'Item não encontrado'; end if;
  if coalesce(next_purchase_price, -1) < 0 then raise exception 'Preço de compra inválido'; end if;
  if coalesce(next_purchased_quantity, 0) <= 0 then raise exception 'Quantidade comprada inválida'; end if;
  if next_purchase_unit not in ('g', 'kg', 'ml', 'l', 'unit', 'package', 'box', 'can', 'tray', 'hour', 'kwh', 'other') then raise exception 'Unidade de compra inválida'; end if;
  if next_useful_quantity is not null and next_useful_quantity <= 0 then raise exception 'Quantidade útil inválida'; end if;
  if next_data_status not in ('provisional', 'awaiting_validation', 'validated', 'blocked') then raise exception 'Status do preço inválido'; end if;

  insert into public.costing_item_prices(
    item_id, purchase_price, purchased_quantity, purchase_unit,
    useful_quantity, effective_at, data_status, source_note, created_by
  ) values (
    target_item_id, next_purchase_price, next_purchased_quantity,
    next_purchase_unit, next_useful_quantity, coalesce(next_effective_at, now()),
    next_data_status, left(btrim(coalesce(next_source_note, '')), 1000),
    (select auth.uid())
  );

  update public.costing_items set updated_at = now(), updated_by = (select auth.uid()) where id = target_item_id;
  return public.manager_get_costing_catalog_workspace(null, target_item_id);
end;
$$;

revoke all on function private.costing_latest_purchase_unit_cost(uuid) from public, anon, authenticated;
revoke all on function private.costing_effective_unit_cost(uuid) from public, anon, authenticated;
revoke all on function private.costing_commercial_item_json(uuid) from public, anon, authenticated;
revoke all on function public.manager_get_costing_catalog_workspace(text, uuid) from public, anon, authenticated;
revoke all on function public.manager_save_costing_catalog_item(uuid, text, text, text, text, text, text, text, numeric, text, numeric, text, boolean, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, text) from public, anon, authenticated;
revoke all on function public.manager_add_costing_item_price(uuid, numeric, numeric, text, numeric, timestamptz, text, text) from public, anon, authenticated;

grant execute on function public.manager_get_costing_catalog_workspace(text, uuid) to authenticated;
grant execute on function public.manager_save_costing_catalog_item(uuid, text, text, text, text, text, text, text, numeric, text, numeric, text, boolean, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, text) to authenticated;
grant execute on function public.manager_add_costing_item_price(uuid, numeric, numeric, text, numeric, timestamptz, text, text) to authenticated;

comment on table public.costing_item_commercial_settings is 'Preço, origem de custo, margem e política comercial por item técnico.';
comment on function public.manager_get_costing_catalog_workspace(text, uuid) is 'Workspace interno de custo, venda, lucro e margem para owner/manager.';

commit;
