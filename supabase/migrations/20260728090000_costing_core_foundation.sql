begin;

create table if not exists public.costing_items (
  id uuid primary key default gen_random_uuid(),
  internal_code text not null check (internal_code ~ '^[A-Z0-9][A-Z0-9._-]{0,39}$'),
  name text not null check (length(btrim(name)) between 1 and 160),
  item_kind text not null check (
    item_kind in ('ingredient', 'packaging', 'utility', 'labor', 'equipment', 'service', 'other')
  ),
  category text not null default '' check (length(category) <= 120),
  brand text not null default '' check (length(brand) <= 120),
  supplier text not null default '' check (length(supplier) <= 160),
  purchase_unit text not null check (purchase_unit in ('g', 'kg', 'ml', 'l', 'unit', 'package', 'box', 'can', 'tray', 'hour', 'kwh', 'other')),
  package_quantity numeric(16,6) not null default 1 check (package_quantity > 0),
  consumption_unit text not null check (consumption_unit in ('g', 'kg', 'ml', 'l', 'unit', 'package', 'box', 'can', 'tray', 'hour', 'kwh', 'other')),
  default_loss_percent numeric(7,4) not null default 0 check (default_loss_percent between 0 and 99.9999),
  shelf_life_days integer check (shelf_life_days is null or shelf_life_days >= 0),
  storage_condition text not null default '' check (length(storage_condition) <= 500),
  data_status text not null default 'provisional' check (
    data_status in ('provisional', 'awaiting_validation', 'validated', 'blocked')
  ),
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (internal_code)
);

create table if not exists public.costing_item_prices (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.costing_items(id) on delete cascade,
  purchase_price numeric(14,4) not null check (purchase_price >= 0),
  purchased_quantity numeric(16,6) not null check (purchased_quantity > 0),
  purchase_unit text not null check (purchase_unit in ('g', 'kg', 'ml', 'l', 'unit', 'package', 'box', 'can', 'tray', 'hour', 'kwh', 'other')),
  useful_quantity numeric(16,6) check (useful_quantity is null or useful_quantity > 0),
  gross_unit_cost numeric(16,6) generated always as (purchase_price / purchased_quantity) stored,
  net_unit_cost numeric(16,6) generated always as (
    purchase_price / coalesce(useful_quantity, purchased_quantity)
  ) stored,
  effective_at timestamptz not null default now(),
  data_status text not null default 'provisional' check (
    data_status in ('provisional', 'awaiting_validation', 'validated', 'blocked')
  ),
  source_note text not null default '' check (length(source_note) <= 1000),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.costing_recipes (
  id uuid primary key default gen_random_uuid(),
  internal_code text not null check (internal_code ~ '^[A-Z0-9][A-Z0-9._-]{0,39}$'),
  name text not null check (length(btrim(name)) between 1 and 180),
  recipe_kind text not null check (recipe_kind in ('intermediate', 'final_product')),
  commercial_product_id uuid references public.commercial_products(id) on delete set null,
  output_unit text not null check (output_unit in ('g', 'kg', 'ml', 'l', 'unit', 'cake', 'slice', 'batch', 'other')),
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (internal_code)
);

create table if not exists public.costing_recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.costing_recipes(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  version_status text not null default 'draft' check (
    version_status in ('draft', 'awaiting_validation', 'validated', 'retired', 'blocked')
  ),
  yield_quantity numeric(16,6) not null check (yield_quantity > 0),
  yield_unit text not null check (yield_unit in ('g', 'kg', 'ml', 'l', 'unit', 'cake', 'slice', 'batch', 'other')),
  gross_weight numeric(16,6) check (gross_weight is null or gross_weight >= 0),
  net_weight numeric(16,6) check (net_weight is null or net_weight >= 0),
  active_minutes numeric(12,2) not null default 0 check (active_minutes >= 0),
  passive_minutes numeric(12,2) not null default 0 check (passive_minutes >= 0),
  valid_from timestamptz,
  valid_until timestamptz,
  change_reason text not null default '' check (length(change_reason) <= 1000),
  notes text not null default '' check (length(notes) <= 4000),
  created_by uuid,
  approved_by uuid,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (recipe_id, version_number),
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (net_weight is null or gross_weight is null or net_weight <= gross_weight)
);

create table if not exists public.costing_recipe_components (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references public.costing_recipe_versions(id) on delete cascade,
  component_kind text not null check (component_kind in ('item', 'recipe_version')),
  item_id uuid references public.costing_items(id) on delete restrict,
  child_recipe_version_id uuid references public.costing_recipe_versions(id) on delete restrict,
  quantity numeric(16,6) not null check (quantity > 0),
  unit text not null check (unit in ('g', 'kg', 'ml', 'l', 'unit', 'package', 'box', 'can', 'tray', 'hour', 'kwh', 'cake', 'slice', 'batch', 'other')),
  loss_percent numeric(7,4) not null default 0 check (loss_percent between 0 and 99.9999),
  placement text not null default 'composition' check (length(placement) between 1 and 80),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  notes text not null default '' check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  check (
    (component_kind = 'item' and item_id is not null and child_recipe_version_id is null)
    or
    (component_kind = 'recipe_version' and item_id is null and child_recipe_version_id is not null)
  ),
  check (child_recipe_version_id is null or child_recipe_version_id <> recipe_version_id)
);

create table if not exists public.costing_resource_allocations (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references public.costing_recipe_versions(id) on delete cascade,
  resource_kind text not null check (
    resource_kind in ('labor', 'energy', 'gas', 'cleaning', 'fixed', 'depreciation', 'maintenance', 'replacement_reserve', 'other')
  ),
  label text not null check (length(btrim(label)) between 1 and 160),
  amount numeric(14,4) not null check (amount >= 0),
  allocation_basis text not null default 'batch' check (
    allocation_basis in ('batch', 'unit', 'weight', 'active_time', 'equipment_time', 'revenue', 'manual')
  ),
  shared_units numeric(16,6) not null default 1 check (shared_units > 0),
  source_detail jsonb not null default '{}'::jsonb check (jsonb_typeof(source_detail) = 'object'),
  data_status text not null default 'provisional' check (
    data_status in ('provisional', 'awaiting_validation', 'validated', 'blocked')
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.costing_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references public.costing_recipe_versions(id) on delete restrict,
  calculated_at timestamptz not null default now(),
  data_status text not null check (
    data_status in ('provisional', 'awaiting_validation', 'validated', 'blocked')
  ),
  yield_quantity numeric(16,6) not null check (yield_quantity > 0),
  cost_breakdown jsonb not null check (jsonb_typeof(cost_breakdown) = 'object'),
  total_cost numeric(14,4) not null check (total_cost >= 0),
  unit_cost numeric(16,6) not null check (unit_cost >= 0),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (recipe_version_id, source_hash)
);

create table if not exists public.costing_channel_prices (
  id uuid primary key default gen_random_uuid(),
  cost_snapshot_id uuid not null references public.costing_cost_snapshots(id) on delete restrict,
  channel text not null check (length(btrim(channel)) between 1 and 80),
  sale_price numeric(14,2) not null check (sale_price >= 0),
  percentage_charges numeric(7,6) not null default 0 check (percentage_charges between 0 and 0.999999),
  fixed_charges numeric(14,4) not null default 0 check (fixed_charges >= 0),
  net_revenue numeric(14,4) not null check (net_revenue >= 0),
  estimated_profit numeric(14,4) not null,
  estimated_margin numeric(9,6) not null,
  minimum_margin numeric(9,6) not null check (minimum_margin between 0 and 0.999999),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from),
  unique (cost_snapshot_id, channel)
);

alter table public.cake_builder_options
  add column if not exists costing_item_id uuid references public.costing_items(id) on delete set null,
  add column if not exists costing_recipe_version_id uuid references public.costing_recipe_versions(id) on delete set null,
  add column if not exists costing_snapshot_id uuid references public.costing_cost_snapshots(id) on delete set null,
  add column if not exists cost_source_status text not null default 'manual_provisional' check (
    cost_source_status in ('manual_provisional', 'technical_sheet', 'validated_snapshot', 'blocked')
  ),
  add column if not exists cost_source_note text not null default '' check (length(cost_source_note) <= 1000),
  add column if not exists cost_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cake_builder_options'::regclass
      and conname = 'cake_builder_options_single_cost_source_check'
  ) then
    alter table public.cake_builder_options
      add constraint cake_builder_options_single_cost_source_check check (
        num_nonnulls(costing_item_id, costing_recipe_version_id) <= 1
      );
  end if;
end;
$$;

create index if not exists costing_item_prices_item_effective_idx
  on public.costing_item_prices (item_id, effective_at desc);
create index if not exists costing_recipe_versions_recipe_status_idx
  on public.costing_recipe_versions (recipe_id, version_status, version_number desc);
create index if not exists costing_recipe_components_version_sort_idx
  on public.costing_recipe_components (recipe_version_id, sort_order);
create index if not exists costing_resource_allocations_version_kind_idx
  on public.costing_resource_allocations (recipe_version_id, resource_kind);
create index if not exists costing_cost_snapshots_version_calculated_idx
  on public.costing_cost_snapshots (recipe_version_id, calculated_at desc);
create index if not exists costing_channel_prices_snapshot_channel_idx
  on public.costing_channel_prices (cost_snapshot_id, channel);
create index if not exists cake_builder_options_costing_item_idx
  on public.cake_builder_options (costing_item_id)
  where costing_item_id is not null;
create index if not exists cake_builder_options_costing_recipe_idx
  on public.cake_builder_options (costing_recipe_version_id)
  where costing_recipe_version_id is not null;

alter table public.costing_items enable row level security;
alter table public.costing_item_prices enable row level security;
alter table public.costing_recipes enable row level security;
alter table public.costing_recipe_versions enable row level security;
alter table public.costing_recipe_components enable row level security;
alter table public.costing_resource_allocations enable row level security;
alter table public.costing_cost_snapshots enable row level security;
alter table public.costing_channel_prices enable row level security;

revoke all on public.costing_items from public, anon, authenticated;
revoke all on public.costing_item_prices from public, anon, authenticated;
revoke all on public.costing_recipes from public, anon, authenticated;
revoke all on public.costing_recipe_versions from public, anon, authenticated;
revoke all on public.costing_recipe_components from public, anon, authenticated;
revoke all on public.costing_resource_allocations from public, anon, authenticated;
revoke all on public.costing_cost_snapshots from public, anon, authenticated;
revoke all on public.costing_channel_prices from public, anon, authenticated;

grant all on public.costing_items to service_role;
grant all on public.costing_item_prices to service_role;
grant all on public.costing_recipes to service_role;
grant all on public.costing_recipe_versions to service_role;
grant all on public.costing_recipe_components to service_role;
grant all on public.costing_resource_allocations to service_role;
grant all on public.costing_cost_snapshots to service_role;
grant all on public.costing_channel_prices to service_role;

comment on table public.costing_items is 'Catálogo técnico interno de ingredientes, embalagens, recursos, mão de obra e equipamentos.';
comment on table public.costing_recipe_versions is 'Versões imutáveis de fichas técnicas; pedidos e snapshots devem referenciar a versão vigente.';
comment on table public.costing_cost_snapshots is 'Retrato versionado do custo calculado, preservado para histórico e pedidos.';
comment on column public.cake_builder_options.unit_cost is 'Fallback manual provisório; quando houver ficha técnica, o custo deve vir de costing_item_id ou costing_recipe_version_id e de um snapshot validado.';

commit;
