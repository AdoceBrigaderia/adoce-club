begin;

create table if not exists public.commercial_product_costing_settings (
  product_id uuid primary key references public.commercial_products(id) on delete cascade,
  cost_origin text not null default 'manual_provisional' check (
    cost_origin in ('recipe_snapshot', 'manual_provisional', 'purchased', 'asset', 'service')
  ),
  recipe_version_id uuid references public.costing_recipe_versions(id) on delete set null,
  cost_snapshot_id uuid references public.costing_cost_snapshots(id) on delete set null,
  manual_total_cost numeric(14,4) not null default 0 check (manual_total_cost >= 0),
  sale_price_override numeric(14,2) check (sale_price_override is null or sale_price_override >= 0),
  yield_quantity numeric(16,4) not null default 1 check (yield_quantity > 0),
  yield_label text not null default 'unidade' check (length(btrim(yield_label)) between 1 and 40),
  minimum_margin numeric(9,6) not null default 0 check (minimum_margin between 0 and 0.999999),
  data_status text not null default 'provisional' check (
    data_status in ('provisional', 'awaiting_validation', 'validated', 'blocked')
  ),
  notes text not null default '' check (length(notes) <= 2000),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    cost_origin <> 'recipe_snapshot'
    or recipe_version_id is not null
    or cost_snapshot_id is not null
  )
);

insert into public.commercial_product_costing_settings(
  product_id,
  cost_origin,
  manual_total_cost,
  sale_price_override,
  yield_quantity,
  yield_label,
  minimum_margin,
  data_status,
  notes
)
select
  product.id,
  'manual_provisional',
  0,
  null,
  case
    when product.segment::text = 'cakes' then coalesce(nullif((product.details->>'yield_slices')::numeric, 0), 13)
    else 1
  end,
  case when product.segment::text = 'cakes' then 'fatias' else 'unidade' end,
  0,
  'provisional',
  'Custo inicial ainda não informado.'
from public.commercial_products product
on conflict (product_id) do nothing;

alter table public.commercial_product_costing_settings enable row level security;
revoke all on public.commercial_product_costing_settings from public, anon, authenticated;
grant all on public.commercial_product_costing_settings to service_role;

create index if not exists commercial_product_costing_origin_status_idx
  on public.commercial_product_costing_settings (cost_origin, data_status);
create index if not exists commercial_product_costing_recipe_idx
  on public.commercial_product_costing_settings (recipe_version_id)
  where recipe_version_id is not null;
create index if not exists commercial_product_costing_snapshot_idx
  on public.commercial_product_costing_settings (cost_snapshot_id)
  where cost_snapshot_id is not null;

create or replace function private.commercial_product_effective_cost(target_product_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  settings public.commercial_product_costing_settings%rowtype;
  resolved_cost numeric := 0;
begin
  select * into settings
  from public.commercial_product_costing_settings profile
  where profile.product_id = target_product_id;

  if settings.product_id is null then
    return 0;
  end if;

  if settings.cost_snapshot_id is not null then
    select snapshot.total_cost into resolved_cost
    from public.costing_cost_snapshots snapshot
    where snapshot.id = settings.cost_snapshot_id
      and snapshot.data_status <> 'blocked';
    if found then return round(greatest(coalesce(resolved_cost, 0), 0), 4); end if;
  end if;

  if settings.recipe_version_id is not null then
    select snapshot.total_cost into resolved_cost
    from public.costing_cost_snapshots snapshot
    where snapshot.recipe_version_id = settings.recipe_version_id
      and snapshot.data_status <> 'blocked'
    order by
      case snapshot.data_status when 'validated' then 0 when 'awaiting_validation' then 1 else 2 end,
      snapshot.calculated_at desc
    limit 1;
    if found then return round(greatest(coalesce(resolved_cost, 0), 0), 4); end if;
  end if;

  return round(greatest(coalesce(settings.manual_total_cost, 0), 0), 4);
end;
$$;

create or replace function private.commercial_product_effective_sale_price(target_product_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(greatest(coalesce(profile.sale_price_override, product.base_price, 0), 0), 2)
  from public.commercial_products product
  join public.commercial_product_costing_settings profile on profile.product_id = product.id
  where product.id = target_product_id;
$$;

create or replace function private.commercial_product_profitability_json(target_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', product.id,
    'name', product.name,
    'slug', product.slug,
    'segment', product.segment,
    'subcategory', product.subcategory,
    'image_url', product.image_url,
    'base_price', product.base_price,
    'published', product.published,
    'active', product.active,
    'cost_origin', profile.cost_origin,
    'recipe_version_id', profile.recipe_version_id,
    'cost_snapshot_id', profile.cost_snapshot_id,
    'manual_total_cost', profile.manual_total_cost,
    'sale_price_override', profile.sale_price_override,
    'yield_quantity', profile.yield_quantity,
    'yield_label', profile.yield_label,
    'minimum_margin', profile.minimum_margin,
    'data_status', profile.data_status,
    'notes', profile.notes,
    'effective_total_cost', private.commercial_product_effective_cost(product.id),
    'effective_sale_price', private.commercial_product_effective_sale_price(product.id),
    'cost_per_yield', round(
      private.commercial_product_effective_cost(product.id) / greatest(profile.yield_quantity, 1),
      4
    ),
    'gross_profit', round(
      private.commercial_product_effective_sale_price(product.id) - private.commercial_product_effective_cost(product.id),
      4
    ),
    'margin', case
      when private.commercial_product_effective_sale_price(product.id) > 0 then round(
        (
          private.commercial_product_effective_sale_price(product.id) - private.commercial_product_effective_cost(product.id)
        ) / private.commercial_product_effective_sale_price(product.id),
        6
      )
      else 0
    end,
    'markup', case
      when private.commercial_product_effective_cost(product.id) > 0 then round(
        private.commercial_product_effective_sale_price(product.id) / private.commercial_product_effective_cost(product.id),
        6
      )
      else 0
    end,
    'margin_alert', private.commercial_product_effective_sale_price(product.id) > 0 and (
      (
        private.commercial_product_effective_sale_price(product.id) - private.commercial_product_effective_cost(product.id)
      ) / private.commercial_product_effective_sale_price(product.id)
    ) < profile.minimum_margin,
    'recipe_versions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', version.id,
        'recipe_id', recipe.id,
        'recipe_name', recipe.name,
        'version_number', version.version_number,
        'version_status', version.version_status,
        'yield_quantity', version.yield_quantity,
        'yield_unit', version.yield_unit,
        'latest_snapshot_id', snapshot.id,
        'latest_snapshot_cost', snapshot.total_cost,
        'latest_snapshot_status', snapshot.data_status,
        'latest_snapshot_at', snapshot.calculated_at
      ) order by version.version_number desc)
      from public.costing_recipes recipe
      join public.costing_recipe_versions version on version.recipe_id = recipe.id
      left join lateral (
        select cost_snapshot.*
        from public.costing_cost_snapshots cost_snapshot
        where cost_snapshot.recipe_version_id = version.id
          and cost_snapshot.data_status <> 'blocked'
        order by
          case cost_snapshot.data_status when 'validated' then 0 when 'awaiting_validation' then 1 else 2 end,
          cost_snapshot.calculated_at desc
        limit 1
      ) snapshot on true
      where recipe.commercial_product_id = product.id
        and recipe.active
        and version.version_status <> 'blocked'
    ), '[]'::jsonb),
    'updated_at', profile.updated_at
  )
  from public.commercial_products product
  join public.commercial_product_costing_settings profile on profile.product_id = product.id
  where product.id = target_product_id;
$$;

create or replace function public.manager_get_product_profitability_workspace(
  search_text text default null,
  requested_product_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selected_product_id uuid;
  normalized_search text := lower(btrim(coalesce(search_text, '')));
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem acessar rentabilidade de produtos';
  end if;

  if requested_product_id is not null and exists (
    select 1 from public.commercial_products product where product.id = requested_product_id
  ) then
    selected_product_id := requested_product_id;
  else
    select product.id into selected_product_id
    from public.commercial_products product
    join public.commercial_product_costing_settings profile on profile.product_id = product.id
    where normalized_search = ''
      or lower(product.name) like '%' || normalized_search || '%'
      or lower(product.slug) like '%' || normalized_search || '%'
      or lower(coalesce(product.subcategory, '')) like '%' || normalized_search || '%'
    order by
      product.active desc,
      (
        private.commercial_product_effective_sale_price(product.id) > 0 and
        (
          private.commercial_product_effective_sale_price(product.id) - private.commercial_product_effective_cost(product.id)
        ) / private.commercial_product_effective_sale_price(product.id) < profile.minimum_margin
      ) desc,
      product.name
    limit 1;
  end if;

  return jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(
        private.commercial_product_profitability_json(product.id)
        order by product.active desc, product.name
      )
      from public.commercial_products product
      join public.commercial_product_costing_settings profile on profile.product_id = product.id
      where normalized_search = ''
        or lower(product.name) like '%' || normalized_search || '%'
        or lower(product.slug) like '%' || normalized_search || '%'
        or lower(coalesce(product.subcategory, '')) like '%' || normalized_search || '%'
    ), '[]'::jsonb),
    'selected_product_id', selected_product_id,
    'selected_product', case
      when selected_product_id is null then null
      else private.commercial_product_profitability_json(selected_product_id)
    end,
    'summary', jsonb_build_object(
      'total_products', (select count(*) from public.commercial_product_costing_settings),
      'configured_products', (
        select count(*) from public.commercial_product_costing_settings profile
        where private.commercial_product_effective_cost(profile.product_id) > 0
      ),
      'products_without_cost', (
        select count(*) from public.commercial_product_costing_settings profile
        where private.commercial_product_effective_cost(profile.product_id) <= 0
      ),
      'margin_alerts', (
        select count(*)
        from public.commercial_product_costing_settings profile
        where private.commercial_product_effective_sale_price(profile.product_id) > 0
          and (
            private.commercial_product_effective_sale_price(profile.product_id) - private.commercial_product_effective_cost(profile.product_id)
          ) / private.commercial_product_effective_sale_price(profile.product_id) < profile.minimum_margin
      ),
      'provisional_costs', (
        select count(*) from public.commercial_product_costing_settings profile
        where profile.cost_origin = 'manual_provisional'
          or profile.data_status in ('provisional', 'awaiting_validation')
      )
    )
  );
end;
$$;

create or replace function public.manager_save_product_costing_settings(
  target_product_id uuid,
  next_cost_origin text default 'manual_provisional',
  next_recipe_version_id uuid default null,
  next_cost_snapshot_id uuid default null,
  next_manual_total_cost numeric default 0,
  next_sale_price_override numeric default null,
  next_yield_quantity numeric default 1,
  next_yield_label text default 'unidade',
  next_minimum_margin numeric default 0,
  next_data_status text default 'provisional',
  next_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_recipe_version_id uuid := next_recipe_version_id;
  normalized_yield_label text := left(btrim(coalesce(next_yield_label, '')), 40);
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem alterar rentabilidade de produtos';
  end if;
  if not exists (select 1 from public.commercial_products product where product.id = target_product_id) then
    raise exception 'Produto não encontrado';
  end if;
  if next_cost_origin not in ('recipe_snapshot', 'manual_provisional', 'purchased', 'asset', 'service') then
    raise exception 'Origem de custo inválida';
  end if;
  if next_data_status not in ('provisional', 'awaiting_validation', 'validated', 'blocked') then
    raise exception 'Status do custo inválido';
  end if;
  if coalesce(next_manual_total_cost, -1) < 0 then raise exception 'Custo total inválido'; end if;
  if next_sale_price_override is not null and next_sale_price_override < 0 then raise exception 'Preço de venda inválido'; end if;
  if coalesce(next_yield_quantity, 0) <= 0 then raise exception 'Rendimento inválido'; end if;
  if normalized_yield_label = '' then raise exception 'Informe a unidade de rendimento'; end if;
  if coalesce(next_minimum_margin, -1) not between 0 and 0.999999 then raise exception 'Margem mínima inválida'; end if;

  if next_cost_snapshot_id is not null then
    select snapshot.recipe_version_id into resolved_recipe_version_id
    from public.costing_cost_snapshots snapshot
    join public.costing_recipe_versions version on version.id = snapshot.recipe_version_id
    join public.costing_recipes recipe on recipe.id = version.recipe_id
    where snapshot.id = next_cost_snapshot_id
      and recipe.commercial_product_id = target_product_id
      and snapshot.data_status <> 'blocked';
    if not found then raise exception 'Snapshot de custo não pertence ao produto'; end if;
  end if;

  if resolved_recipe_version_id is not null and not exists (
    select 1
    from public.costing_recipe_versions version
    join public.costing_recipes recipe on recipe.id = version.recipe_id
    where version.id = resolved_recipe_version_id
      and recipe.commercial_product_id = target_product_id
      and recipe.active
      and version.version_status <> 'blocked'
  ) then
    raise exception 'Ficha técnica não pertence ao produto';
  end if;

  if next_cost_origin = 'recipe_snapshot' and resolved_recipe_version_id is null then
    raise exception 'Selecione uma ficha técnica para usar o custo calculado';
  end if;

  insert into public.commercial_product_costing_settings(
    product_id, cost_origin, recipe_version_id, cost_snapshot_id,
    manual_total_cost, sale_price_override, yield_quantity, yield_label,
    minimum_margin, data_status, notes, created_by, updated_by
  ) values (
    target_product_id,
    next_cost_origin,
    case when next_cost_origin = 'recipe_snapshot' then resolved_recipe_version_id else null end,
    case when next_cost_origin = 'recipe_snapshot' then next_cost_snapshot_id else null end,
    greatest(coalesce(next_manual_total_cost, 0), 0),
    next_sale_price_override,
    next_yield_quantity,
    normalized_yield_label,
    next_minimum_margin,
    next_data_status,
    left(btrim(coalesce(next_notes, '')), 2000),
    (select auth.uid()),
    (select auth.uid())
  )
  on conflict (product_id) do update set
    cost_origin = excluded.cost_origin,
    recipe_version_id = excluded.recipe_version_id,
    cost_snapshot_id = excluded.cost_snapshot_id,
    manual_total_cost = excluded.manual_total_cost,
    sale_price_override = excluded.sale_price_override,
    yield_quantity = excluded.yield_quantity,
    yield_label = excluded.yield_label,
    minimum_margin = excluded.minimum_margin,
    data_status = excluded.data_status,
    notes = excluded.notes,
    updated_by = (select auth.uid()),
    updated_at = now();

  return public.manager_get_product_profitability_workspace(null, target_product_id);
end;
$$;

revoke all on function private.commercial_product_effective_cost(uuid) from public, anon, authenticated;
revoke all on function private.commercial_product_effective_sale_price(uuid) from public, anon, authenticated;
revoke all on function private.commercial_product_profitability_json(uuid) from public, anon, authenticated;
revoke all on function public.manager_get_product_profitability_workspace(text, uuid) from public, anon, authenticated;
revoke all on function public.manager_save_product_costing_settings(uuid, text, uuid, uuid, numeric, numeric, numeric, text, numeric, text, text) from public, anon, authenticated;

grant execute on function public.manager_get_product_profitability_workspace(text, uuid) to authenticated;
grant execute on function public.manager_save_product_costing_settings(uuid, text, uuid, uuid, numeric, numeric, numeric, text, numeric, text, text) to authenticated;

comment on table public.commercial_product_costing_settings is
  'Origem de custo, preço administrativo, rendimento e margem mínima dos produtos comerciais.';
comment on function public.manager_get_product_profitability_workspace(text, uuid) is
  'Relatório interno de custo, preço, lucro, margem e alertas dos produtos fixos.';

commit;
