begin;

create table if not exists public.service_request_pricing_snapshots (
  request_id uuid primary key references public.service_requests(id) on delete restrict,
  product_id uuid not null references public.commercial_products(id) on delete restrict,
  requested_quantity integer not null check (requested_quantity > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  unit_cost numeric(14,4) not null check (unit_cost >= 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  total_cost numeric(16,4) not null check (total_cost >= 0),
  total_price numeric(16,2) not null check (total_price >= 0),
  gross_profit numeric(16,4) not null,
  margin numeric(9,6) not null,
  markup numeric(12,6) not null,
  minimum_margin numeric(9,6) not null check (minimum_margin between 0 and 0.999999),
  margin_alert boolean not null default false,
  cost_origin text not null check (
    cost_origin in ('recipe_snapshot', 'manual_provisional', 'purchased', 'asset', 'service')
  ),
  data_status text not null check (
    data_status in ('provisional', 'awaiting_validation', 'validated', 'blocked')
  ),
  recipe_version_id uuid references public.costing_recipe_versions(id) on delete set null,
  cost_snapshot_id uuid references public.costing_cost_snapshots(id) on delete set null,
  selection_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(selection_snapshot) = 'object'),
  calculation_snapshot jsonb not null check (jsonb_typeof(calculation_snapshot) = 'object'),
  captured_at timestamptz not null default now(),
  created_by uuid
);

alter table public.service_request_pricing_snapshots enable row level security;
revoke all on public.service_request_pricing_snapshots from public, anon, authenticated;
grant all on public.service_request_pricing_snapshots to service_role;

create index if not exists service_request_pricing_product_captured_idx
  on public.service_request_pricing_snapshots (product_id, captured_at desc);
create index if not exists service_request_pricing_margin_alert_idx
  on public.service_request_pricing_snapshots (margin_alert, captured_at desc)
  where margin_alert;

create or replace function private.prevent_service_request_pricing_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'O snapshot financeiro da encomenda é imutável';
  return null;
end;
$$;

revoke all on function private.prevent_service_request_pricing_snapshot_mutation()
  from public, anon, authenticated;

drop trigger if exists service_request_pricing_snapshot_immutable
  on public.service_request_pricing_snapshots;
create trigger service_request_pricing_snapshot_immutable
before update or delete on public.service_request_pricing_snapshots
for each row execute function private.prevent_service_request_pricing_snapshot_mutation();

create or replace function private.capture_service_request_pricing_snapshot(
  target_request_id uuid,
  target_product_id uuid,
  target_quantity integer,
  target_selections jsonb default '{}'::jsonb,
  target_cake_quote jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profitability jsonb;
  normalized_selections jsonb := case
    when jsonb_typeof(coalesce(target_selections, '{}'::jsonb)) = 'object'
      then coalesce(target_selections, '{}'::jsonb)
    else '{}'::jsonb
  end;
  normalized_quote jsonb := case
    when jsonb_typeof(target_cake_quote) = 'object' then target_cake_quote
    else null
  end;
  base_unit_cost numeric(14,4);
  base_unit_price numeric(14,2);
  catalog_base_price numeric(14,2);
  quote_estimated_price numeric(14,2) := 0;
  quote_option_cost numeric(14,4) := 0;
  quote_price_adjustment numeric(14,2) := 0;
  resolved_unit_cost numeric(14,4);
  resolved_unit_price numeric(14,2);
  resolved_total_cost numeric(16,4);
  resolved_total_price numeric(16,2);
  resolved_profit numeric(16,4);
  resolved_margin numeric(9,6);
  resolved_markup numeric(12,6);
  inserted_count integer := 0;
begin
  if target_request_id is null then raise exception 'Solicitação inválida para snapshot'; end if;
  if target_product_id is null then raise exception 'Produto inválido para snapshot'; end if;
  if coalesce(target_quantity, 0) <= 0 then raise exception 'Quantidade inválida para snapshot'; end if;
  if not exists (select 1 from public.service_requests request where request.id = target_request_id) then
    raise exception 'Solicitação não encontrada para snapshot';
  end if;

  if exists (
    select 1
    from public.service_request_pricing_snapshots snapshot
    where snapshot.request_id = target_request_id
  ) then
    return false;
  end if;

  profitability := private.commercial_product_profitability_json(target_product_id);
  if profitability is null then
    raise exception 'Rentabilidade do produto não configurada';
  end if;

  base_unit_cost := round(greatest(coalesce((profitability->>'effective_total_cost')::numeric, 0), 0), 4);
  base_unit_price := round(greatest(coalesce((profitability->>'effective_sale_price')::numeric, 0), 0), 2);
  catalog_base_price := round(greatest(coalesce((profitability->>'base_price')::numeric, 0), 0), 2);

  if normalized_quote is not null then
    quote_estimated_price := round(greatest(coalesce((normalized_quote->>'estimated_price')::numeric, 0), 0), 2);
    quote_option_cost := round(greatest(coalesce((normalized_quote->>'estimated_internal_cost')::numeric, 0), 0), 4);
    quote_price_adjustment := round(greatest(quote_estimated_price - catalog_base_price, 0), 2);
  end if;

  resolved_unit_cost := round(base_unit_cost + quote_option_cost, 4);
  resolved_unit_price := round(base_unit_price + quote_price_adjustment, 2);
  resolved_total_cost := round(resolved_unit_cost * target_quantity, 4);
  resolved_total_price := round(resolved_unit_price * target_quantity, 2);
  resolved_profit := round(resolved_total_price - resolved_total_cost, 4);
  resolved_margin := case
    when resolved_total_price > 0 then round(resolved_profit / resolved_total_price, 6)
    else 0
  end;
  resolved_markup := case
    when resolved_total_cost > 0 then round(resolved_total_price / resolved_total_cost, 6)
    else 0
  end;

  insert into public.service_request_pricing_snapshots(
    request_id,
    product_id,
    requested_quantity,
    unit_cost,
    unit_price,
    total_cost,
    total_price,
    gross_profit,
    margin,
    markup,
    minimum_margin,
    margin_alert,
    cost_origin,
    data_status,
    recipe_version_id,
    cost_snapshot_id,
    selection_snapshot,
    calculation_snapshot,
    created_by
  ) values (
    target_request_id,
    target_product_id,
    target_quantity,
    resolved_unit_cost,
    resolved_unit_price,
    resolved_total_cost,
    resolved_total_price,
    resolved_profit,
    resolved_margin,
    resolved_markup,
    greatest(coalesce((profitability->>'minimum_margin')::numeric, 0), 0),
    resolved_total_price > 0 and resolved_margin < greatest(coalesce((profitability->>'minimum_margin')::numeric, 0), 0),
    profitability->>'cost_origin',
    profitability->>'data_status',
    nullif(profitability->>'recipe_version_id', '')::uuid,
    nullif(profitability->>'cost_snapshot_id', '')::uuid,
    normalized_selections,
    jsonb_build_object(
      'schema_version', 1,
      'calculation_source', 'commercial_product_profitability_v1',
      'product', jsonb_build_object(
        'id', profitability->'id',
        'name', profitability->'name',
        'slug', profitability->'slug',
        'segment', profitability->'segment'
      ),
      'base_unit_cost', base_unit_cost,
      'base_unit_price', base_unit_price,
      'cake_builder_option_cost', quote_option_cost,
      'cake_builder_price_adjustment', quote_price_adjustment,
      'cake_builder_quote', normalized_quote,
      'unit_cost', resolved_unit_cost,
      'unit_price', resolved_unit_price,
      'quantity', target_quantity,
      'total_cost', resolved_total_cost,
      'total_price', resolved_total_price,
      'gross_profit', resolved_profit,
      'margin', resolved_margin,
      'markup', resolved_markup,
      'minimum_margin', greatest(coalesce((profitability->>'minimum_margin')::numeric, 0), 0),
      'margin_alert', resolved_total_price > 0 and resolved_margin < greatest(coalesce((profitability->>'minimum_margin')::numeric, 0), 0),
      'yield_quantity', profitability->'yield_quantity',
      'yield_label', profitability->'yield_label',
      'cost_origin', profitability->'cost_origin',
      'data_status', profitability->'data_status',
      'recipe_version_id', profitability->'recipe_version_id',
      'cost_snapshot_id', profitability->'cost_snapshot_id',
      'captured_at', to_jsonb(now())
    ),
    null
  )
  on conflict (request_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count > 0;
end;
$$;

revoke all on function private.capture_service_request_pricing_snapshot(uuid, uuid, integer, jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.manager_get_service_request_pricing_snapshot(
  target_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem consultar o snapshot financeiro';
  end if;

  select jsonb_build_object(
    'request_id', snapshot.request_id,
    'product_id', snapshot.product_id,
    'requested_quantity', snapshot.requested_quantity,
    'currency', snapshot.currency,
    'unit_cost', snapshot.unit_cost,
    'unit_price', snapshot.unit_price,
    'total_cost', snapshot.total_cost,
    'total_price', snapshot.total_price,
    'gross_profit', snapshot.gross_profit,
    'margin', snapshot.margin,
    'markup', snapshot.markup,
    'minimum_margin', snapshot.minimum_margin,
    'margin_alert', snapshot.margin_alert,
    'cost_origin', snapshot.cost_origin,
    'data_status', snapshot.data_status,
    'recipe_version_id', snapshot.recipe_version_id,
    'cost_snapshot_id', snapshot.cost_snapshot_id,
    'selection_snapshot', snapshot.selection_snapshot,
    'calculation_snapshot', snapshot.calculation_snapshot,
    'captured_at', snapshot.captured_at
  )
  into result
  from public.service_request_pricing_snapshots snapshot
  where snapshot.request_id = target_request_id;

  return result;
end;
$$;

revoke all on function public.manager_get_service_request_pricing_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function public.manager_get_service_request_pricing_snapshot(uuid)
  to authenticated;

create or replace function public.submit_service_request_bff(
  requested_operation_key uuid,
  requested_product_id uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_customer_email text,
  requested_quantity integer,
  requested_start timestamptz,
  requested_end timestamptz,
  requested_location text default '',
  requested_selections jsonb default '{}'::jsonb,
  requested_notes text default '',
  requested_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  response jsonb;
  existing_request public.service_requests%rowtype;
  target_request_id uuid;
  linked_profile_id uuid;
  cake_quote jsonb;
  canonical_selections jsonb := coalesce(requested_selections, '{}'::jsonb);
  pricing_snapshot_captured boolean := false;
begin
  if requested_operation_key is null then
    raise exception 'Chave da solicitação é obrigatória';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public-service-request:' || requested_operation_key::text, 0)
  );

  select request.*
  into existing_request
  from public.service_requests request
  where request.public_request_key = requested_operation_key
  limit 1;

  if existing_request.id is not null then
    return jsonb_build_object(
      'accepted', true,
      'request_id', existing_request.id,
      'request_number', existing_request.request_number,
      'expires_at', existing_request.expires_at,
      'conflict', null,
      'competing_prebooks', 0,
      'idempotent', true,
      'cake_builder_confirmed', exists (
        select 1 from public.service_request_cake_builds build where build.request_id = existing_request.id
      ),
      'pricing_snapshot_captured', exists (
        select 1
        from public.service_request_pricing_snapshots snapshot
        where snapshot.request_id = existing_request.id
      ),
      'message', 'Esta pré-reserva já havia sido registrada.'
    );
  end if;

  cake_quote := private.canonicalize_cake_builder_selection(
    requested_product_id,
    canonical_selections
  );
  if cake_quote is not null then
    canonical_selections := (canonical_selections - 'cake_builder') || jsonb_build_object(
      'cake_builder', cake_quote->'selection',
      'cake_builder_summary', cake_quote->'summary',
      'estimated_price', cake_quote->'estimated_price'
    );
  end if;

  response := public.submit_service_request(
    requested_product_id,
    requested_customer_name,
    requested_customer_phone,
    requested_customer_email,
    requested_quantity,
    requested_start,
    requested_end,
    requested_location,
    canonical_selections,
    requested_notes
  );

  if not coalesce((response->>'accepted')::boolean, false) then
    return response || jsonb_build_object('idempotent', false, 'pricing_snapshot_captured', false);
  end if;

  target_request_id := (response->>'request_id')::uuid;
  if requested_profile_id is not null and exists (
    select 1
    from public.profiles profile
    where profile.id = requested_profile_id
  ) then
    linked_profile_id := requested_profile_id;
  end if;

  update public.service_requests
  set public_request_key = requested_operation_key,
      profile_id = coalesce(linked_profile_id, profile_id)
  where id = target_request_id;

  if not found then
    raise exception 'A pré-reserva foi criada sem vínculo interno';
  end if;

  if cake_quote is not null then
    insert into public.service_request_cake_builds(
      request_id,
      product_id,
      template_id,
      canonical_selection,
      selection_summary,
      estimated_price,
      estimated_internal_cost
    ) values (
      target_request_id,
      requested_product_id,
      (cake_quote->>'template_id')::uuid,
      cake_quote->'selection',
      cake_quote->'summary',
      (cake_quote->>'estimated_price')::numeric,
      (cake_quote->>'estimated_internal_cost')::numeric
    );
    response := response || jsonb_build_object(
      'estimated_price', cake_quote->'estimated_price',
      'cake_builder_confirmed', true
    );
  end if;

  pricing_snapshot_captured := private.capture_service_request_pricing_snapshot(
    target_request_id,
    requested_product_id,
    requested_quantity,
    canonical_selections,
    cake_quote
  );

  return response || jsonb_build_object(
    'idempotent', false,
    'profile_linked', linked_profile_id is not null,
    'pricing_snapshot_captured', pricing_snapshot_captured
  );
end;
$$;

revoke all on function public.submit_service_request_bff(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid
) from public, anon, authenticated;
grant execute on function public.submit_service_request_bff(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid
) to service_role;

comment on table public.service_request_pricing_snapshots is
  'Snapshot imutável do custo, preço e margem vigentes quando a encomenda foi registrada.';
comment on function public.manager_get_service_request_pricing_snapshot(uuid) is
  'Consulta interna do snapshot financeiro imutável associado a uma encomenda.';

commit;
