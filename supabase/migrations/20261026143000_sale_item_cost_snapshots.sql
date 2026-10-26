begin;

-- These are immutable facts of the sale, not a second product catalogue.
-- No backfill: pre-migration items have no snapshot row. Public item columns
-- must never carry manager-only costs under the existing staff read policy.
create table private.instant_order_item_cost_snapshots (
  -- No cascading FK: ordinary order editing can remove/recreate public items,
  -- while the original evidence must survive independently of those edits.
  instant_order_item_id uuid primary key,
  table_unit_price_snapshot numeric(10,2) check (table_unit_price_snapshot >= 0),
  unit_cost_snapshot numeric(16,6) check (unit_cost_snapshot >= 0),
  cost_confidence text not null
    check (cost_confidence in ('historical', 'estimated_current', 'missing')),
  cost_breakdown_snapshot jsonb not null check (jsonb_typeof(cost_breakdown_snapshot) = 'object'),
  cost_snapshot_at timestamptz not null
);
alter table private.instant_order_item_cost_snapshots enable row level security;
revoke all on table private.instant_order_item_cost_snapshots from public, anon, authenticated;

-- Existing item insertion permissions/RLS remain authoritative.
-- Definer privileges are needed to read manager-only costs during public checkout;
-- the trigger function is private and cannot be executed as a public RPC.
create function private.snapshot_instant_order_item_cost()
returns trigger
language plpgsql security definer set search_path = ''
as $function$
declare
  table_price numeric;
  current_cost numeric;
  source_updated_at timestamptz;
  recipe_context jsonb;
  confidence text;
  breakdown jsonb;
  captured_at timestamptz := statement_timestamp();
begin
  if exists (
    select 1 from private.instant_order_item_cost_snapshots
    where instant_order_item_id = new.id
  ) then
    return new;
  end if;

  select f.base_price, c.unit_cost, c.updated_at
  into table_price, current_cost, source_updated_at
  from public.flavors f
  left join public.flavor_costs c on c.flavor_id = f.id
  where f.id = new.flavor_id;

  -- The manual flavor cost has no monetary component allocation. Preserve the
  -- available direct component classifications as context, never as a fabricated
  -- decomposition of that total. Child recipes remain explicit references.
  select jsonb_build_object(
    'recipe_id', r.id,
    'recipe_version_id', v.id,
    'version_number', v.version_number,
    'size_code', v.size_code,
    'yield_quantity', v.yield_quantity,
    'yield_unit', v.yield_unit,
    'classification_scope', 'direct_components_only',
    'reconciled_to_unit_cost', false,
    'components', coalesce((
      select jsonb_agg(jsonb_build_object(
        'component_id', c.id,
        'component_kind', c.component_kind,
        'item_id', c.item_id,
        'item_kind', i.item_kind,
        'child_recipe_version_id', c.child_recipe_version_id,
        'quantity', c.quantity,
        'unit', c.unit,
        'placement', c.placement,
        'loss_percent', c.loss_percent
      ) order by c.sort_order, c.id)
      from public.costing_recipe_components c
      left join public.costing_items i on i.id = c.item_id
      where c.recipe_version_id = v.id
    ), '[]'::jsonb),
    'resource_classifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'allocation_id', a.id,
        'resource_kind', a.resource_kind,
        'allocation_basis', a.allocation_basis,
        'declared_amount', a.amount,
        'shared_units', a.shared_units
      ) order by a.id)
      from public.costing_resource_allocations a
      where a.recipe_version_id = v.id
    ), '[]'::jsonb)
  ) into recipe_context
  from public.costing_recipes r
  join public.costing_recipe_versions v on v.recipe_id = r.id
  where r.flavor_id = new.flavor_id and r.active
    and r.recipe_kind = 'final_product' and v.size_code = 'G'
  order by v.version_number desc, v.created_at desc, v.id
  limit 1;

  -- A cost recorded at insertion is prospective historical evidence, including
  -- an explicitly registered zero. Absence stays NULL and is never zero-filled.
  confidence := case when current_cost is null then 'missing' else 'historical' end;
  breakdown := jsonb_build_object(
    'schema_version', 1,
    'captured_at', captured_at,
    'sale_source', jsonb_build_object(
      'table', 'public.instant_order_items', 'instant_order_item_id', new.id,
      'order_id', new.order_id, 'flavor_id', new.flavor_id,
      'charged_unit_price', new.unit_price
    ),
    'price_source', jsonb_build_object(
      'table', 'public.flavors', 'column', 'base_price', 'flavor_id', new.flavor_id
    ),
    'cost_source', jsonb_build_object(
      'table', 'public.flavor_costs', 'column', 'unit_cost',
      'flavor_id', new.flavor_id, 'updated_at', source_updated_at
    ),
    'allocation_status', 'unallocated_manual_total',
    'recipe_context', recipe_context
  );
  insert into private.instant_order_item_cost_snapshots (
    instant_order_item_id, table_unit_price_snapshot, unit_cost_snapshot,
    cost_confidence, cost_breakdown_snapshot, cost_snapshot_at
  ) values (
    new.id, table_price, current_cost, confidence, breakdown, captured_at
  ) on conflict (instant_order_item_id) do nothing;
  return new;
end;
$function$;
revoke all on function private.snapshot_instant_order_item_cost() from public, anon, authenticated;

create trigger instant_order_items_snapshot_cost
after insert on public.instant_order_items
for each row execute function private.snapshot_instant_order_item_cost();

-- Private sale evidence cannot be rewritten or removed. Public item updates do
-- not fire a cost capture and historical items never acquire retroactive rows.
create function private.preserve_instant_order_item_cost()
returns trigger
language plpgsql set search_path = ''
as $function$
begin
  raise exception 'Sale item cost snapshots are immutable' using errcode = '23514';
end;
$function$;
revoke all on function private.preserve_instant_order_item_cost() from public, anon, authenticated;

create trigger instant_order_item_cost_snapshots_immutable
before update or delete on private.instant_order_item_cost_snapshots
for each row execute function private.preserve_instant_order_item_cost();

create trigger instant_order_item_cost_snapshots_no_truncate
before truncate on private.instant_order_item_cost_snapshots
for each statement execute function private.preserve_instant_order_item_cost();

commit;
