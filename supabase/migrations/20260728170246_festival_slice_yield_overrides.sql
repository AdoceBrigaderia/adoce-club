begin;

create table if not exists public.commercial_product_yield_overrides (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commercial_products(id) on delete cascade,
  context_type text not null check (context_type in ('action', 'event')),
  context_key text not null check (
    length(context_key) between 2 and 80
    and context_key = lower(btrim(context_key))
  ),
  context_label text not null check (length(btrim(context_label)) between 2 and 120),
  yield_quantity numeric(16,4) not null check (yield_quantity > 0),
  authorized_slice_price numeric(14,2) not null check (authorized_slice_price > 0),
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, context_type, context_key),
  check (valid_until is null or valid_until > valid_from)
);

alter table public.commercial_product_yield_overrides enable row level security;
revoke all on public.commercial_product_yield_overrides from public, anon, authenticated;
grant all on public.commercial_product_yield_overrides to service_role;

create index if not exists commercial_product_yield_overrides_active_idx
  on public.commercial_product_yield_overrides (product_id, active, valid_from, valid_until);

create table if not exists public.commercial_product_yield_sale_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key uuid not null unique,
  sale_reference text not null check (length(btrim(sale_reference)) between 2 and 160),
  product_id uuid not null references public.commercial_products(id) on delete restrict,
  override_id uuid not null references public.commercial_product_yield_overrides(id) on delete restrict,
  context_type text not null check (context_type in ('action', 'event')),
  context_key text not null check (length(context_key) between 2 and 80),
  context_label text not null check (length(context_label) between 2 and 120),
  yield_label text not null check (length(yield_label) between 1 and 40),
  standard_yield_quantity numeric(16,4) not null check (standard_yield_quantity > 0),
  applied_yield_quantity numeric(16,4) not null check (applied_yield_quantity > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  total_cost numeric(16,4) not null check (total_cost >= 0),
  cost_per_slice numeric(16,4) not null check (cost_per_slice >= 0),
  authorized_slice_price numeric(14,2) not null check (authorized_slice_price > 0),
  projected_total_revenue numeric(16,2) not null check (projected_total_revenue >= 0),
  gross_profit_per_slice numeric(16,4) not null,
  projected_gross_profit numeric(16,4) not null,
  margin numeric(9,6) not null,
  markup numeric(12,6) not null,
  minimum_margin numeric(9,6) not null check (minimum_margin between 0 and 0.999999),
  margin_alert boolean not null,
  cost_origin text not null check (
    cost_origin in ('recipe_snapshot', 'manual_provisional', 'purchased', 'asset', 'service')
  ),
  data_status text not null check (
    data_status in ('provisional', 'awaiting_validation', 'validated', 'blocked')
  ),
  recipe_version_id uuid references public.costing_recipe_versions(id) on delete restrict,
  cost_snapshot_id uuid references public.costing_cost_snapshots(id) on delete restrict,
  calculation_snapshot jsonb not null check (jsonb_typeof(calculation_snapshot) = 'object'),
  captured_by uuid,
  captured_at timestamptz not null default now()
);

alter table public.commercial_product_yield_sale_snapshots enable row level security;
revoke all on public.commercial_product_yield_sale_snapshots from public, anon, authenticated;
grant all on public.commercial_product_yield_sale_snapshots to service_role;

create index if not exists commercial_product_yield_sale_snapshots_product_idx
  on public.commercial_product_yield_sale_snapshots (product_id, captured_at desc);
create index if not exists commercial_product_yield_sale_snapshots_reference_idx
  on public.commercial_product_yield_sale_snapshots (sale_reference, captured_at desc);

create or replace function private.commercial_product_slice_quote_json(
  target_product_id uuid,
  target_override_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  product_profile public.commercial_product_costing_settings%rowtype;
  yield_override public.commercial_product_yield_overrides%rowtype;
  resolved_total_cost numeric(16,4);
  resolved_cost_per_slice numeric(16,4);
  resolved_total_revenue numeric(16,2);
  resolved_gross_profit_per_slice numeric(16,4);
  resolved_projected_gross_profit numeric(16,4);
  resolved_margin numeric(9,6);
  resolved_markup numeric(12,6);
begin
  select profile.*
  into product_profile
  from public.commercial_product_costing_settings profile
  where profile.product_id = target_product_id;

  if product_profile.product_id is null then
    raise exception 'Rentabilidade do produto não configurada';
  end if;

  select setting.*
  into yield_override
  from public.commercial_product_yield_overrides setting
  where setting.id = target_override_id
    and setting.product_id = target_product_id;

  if yield_override.id is null then
    raise exception 'Rendimento da ação ou evento não encontrado para o produto';
  end if;

  resolved_total_cost := round(
    greatest(coalesce(private.commercial_product_effective_cost(target_product_id), 0), 0),
    4
  );
  resolved_cost_per_slice := round(
    resolved_total_cost / yield_override.yield_quantity,
    4
  );
  resolved_total_revenue := round(
    yield_override.authorized_slice_price * yield_override.yield_quantity,
    2
  );
  resolved_gross_profit_per_slice := round(
    yield_override.authorized_slice_price - resolved_cost_per_slice,
    4
  );
  resolved_projected_gross_profit := round(
    resolved_total_revenue - resolved_total_cost,
    4
  );
  resolved_margin := case
    when yield_override.authorized_slice_price > 0 then round(
      resolved_gross_profit_per_slice / yield_override.authorized_slice_price,
      6
    )
    else 0
  end;
  resolved_markup := case
    when resolved_cost_per_slice > 0 then round(
      yield_override.authorized_slice_price / resolved_cost_per_slice,
      6
    )
    else 0
  end;

  return jsonb_build_object(
    'override_id', yield_override.id,
    'product_id', target_product_id,
    'context_type', yield_override.context_type,
    'context_key', yield_override.context_key,
    'context_label', yield_override.context_label,
    'active', yield_override.active,
    'valid_from', yield_override.valid_from,
    'valid_until', yield_override.valid_until,
    'yield_label', product_profile.yield_label,
    'standard_yield_quantity', product_profile.yield_quantity,
    'applied_yield_quantity', yield_override.yield_quantity,
    'total_cost', resolved_total_cost,
    'cost_per_slice', resolved_cost_per_slice,
    'authorized_slice_price', yield_override.authorized_slice_price,
    'projected_total_revenue', resolved_total_revenue,
    'gross_profit_per_slice', resolved_gross_profit_per_slice,
    'projected_gross_profit', resolved_projected_gross_profit,
    'margin', resolved_margin,
    'markup', resolved_markup,
    'minimum_margin', product_profile.minimum_margin,
    'margin_alert', resolved_margin < product_profile.minimum_margin,
    'cost_origin', product_profile.cost_origin,
    'data_status', product_profile.data_status,
    'recipe_version_id', product_profile.recipe_version_id,
    'cost_snapshot_id', product_profile.cost_snapshot_id
  );
end;
$$;

create or replace function private.commercial_product_yield_overrides_json(
  target_product_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      private.commercial_product_slice_quote_json(setting.product_id, setting.id)
      order by setting.active desc, setting.valid_from desc, setting.context_label
    ),
    '[]'::jsonb
  )
  from public.commercial_product_yield_overrides setting
  where setting.product_id = target_product_id;
$$;

create or replace function private.prevent_commercial_product_yield_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'O snapshot de rendimento e preço da venda é imutável';
  return null;
end;
$$;

drop trigger if exists commercial_product_yield_sale_snapshot_immutable
  on public.commercial_product_yield_sale_snapshots;
create trigger commercial_product_yield_sale_snapshot_immutable
before update or delete on public.commercial_product_yield_sale_snapshots
for each row execute function private.prevent_commercial_product_yield_snapshot_mutation();

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
          private.commercial_product_effective_sale_price(product.id)
          - private.commercial_product_effective_cost(product.id)
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
        || jsonb_build_object(
          'yield_overrides',
          private.commercial_product_yield_overrides_json(selected_product_id)
        )
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
            private.commercial_product_effective_sale_price(profile.product_id)
            - private.commercial_product_effective_cost(profile.product_id)
          ) / private.commercial_product_effective_sale_price(profile.product_id) < profile.minimum_margin
      ),
      'provisional_costs', (
        select count(*) from public.commercial_product_costing_settings profile
        where profile.cost_origin = 'manual_provisional'
          or profile.data_status in ('provisional', 'awaiting_validation')
      ),
      'active_yield_overrides', (
        select count(*)
        from public.commercial_product_yield_overrides setting
        where setting.active
          and setting.valid_from <= now()
          and (setting.valid_until is null or setting.valid_until > now())
      )
    )
  );
end;
$$;

create or replace function public.manager_save_product_yield_override(
  target_product_id uuid,
  target_override_id uuid default null,
  next_context_type text default 'event',
  next_context_key text default '',
  next_context_label text default '',
  next_yield_quantity numeric default 1,
  requested_slice_price numeric default 0,
  next_active boolean default true,
  next_valid_from timestamptz default null,
  next_valid_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_context_type text := lower(btrim(coalesce(next_context_type, '')));
  normalized_context_key text := lower(btrim(coalesce(next_context_key, '')));
  normalized_context_label text := left(btrim(coalesce(next_context_label, '')), 120);
  resolved_valid_from timestamptz := coalesce(next_valid_from, now());
  saved_override_id uuid;
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem alterar rendimentos por ação ou evento';
  end if;
  if not exists (
    select 1 from public.commercial_product_costing_settings profile
    where profile.product_id = target_product_id
  ) then
    raise exception 'Rentabilidade do produto não configurada';
  end if;
  if normalized_context_type not in ('action', 'event') then
    raise exception 'Contexto inválido: use ação ou evento';
  end if;
  if length(normalized_context_key) not between 2 and 80 then
    raise exception 'Informe uma chave de contexto entre 2 e 80 caracteres';
  end if;
  if length(normalized_context_label) not between 2 and 120 then
    raise exception 'Informe o nome da ação ou evento';
  end if;
  if coalesce(next_yield_quantity, 0) <= 0 then
    raise exception 'Rendimento da ação ou evento inválido';
  end if;
  if coalesce(requested_slice_price, 0) <= 0 then
    raise exception 'Preço por fatia proposto inválido';
  end if;
  if next_valid_until is not null and next_valid_until <= resolved_valid_from then
    raise exception 'A data final deve ser posterior à data inicial';
  end if;

  if target_override_id is null then
    insert into public.commercial_product_yield_overrides(
      product_id,
      context_type,
      context_key,
      context_label,
      yield_quantity,
      authorized_slice_price,
      active,
      valid_from,
      valid_until,
      created_by,
      updated_by
    ) values (
      target_product_id,
      normalized_context_type,
      normalized_context_key,
      normalized_context_label,
      next_yield_quantity,
      requested_slice_price,
      coalesce(next_active, true),
      resolved_valid_from,
      next_valid_until,
      (select auth.uid()),
      (select auth.uid())
    )
    on conflict (product_id, context_type, context_key) do update set
      context_label = excluded.context_label,
      yield_quantity = excluded.yield_quantity,
      authorized_slice_price = excluded.authorized_slice_price,
      active = excluded.active,
      valid_from = excluded.valid_from,
      valid_until = excluded.valid_until,
      updated_by = (select auth.uid()),
      updated_at = now()
    returning id into saved_override_id;
  else
    update public.commercial_product_yield_overrides setting
    set context_type = normalized_context_type,
        context_key = normalized_context_key,
        context_label = normalized_context_label,
        yield_quantity = next_yield_quantity,
        authorized_slice_price = requested_slice_price,
        active = coalesce(next_active, true),
        valid_from = resolved_valid_from,
        valid_until = next_valid_until,
        updated_by = (select auth.uid()),
        updated_at = now()
    where setting.id = target_override_id
      and setting.product_id = target_product_id
    returning setting.id into saved_override_id;

    if saved_override_id is null then
      raise exception 'Rendimento da ação ou evento não encontrado para o produto';
    end if;
  end if;

  return public.manager_get_product_profitability_workspace(null, target_product_id);
end;
$$;

create or replace function public.manager_capture_product_yield_sale_snapshot(
  target_product_id uuid,
  target_context_type text,
  target_context_key text,
  target_sale_reference text,
  operation_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_context_type text := lower(btrim(coalesce(target_context_type, '')));
  normalized_context_key text := lower(btrim(coalesce(target_context_key, '')));
  normalized_sale_reference text := left(btrim(coalesce(target_sale_reference, '')), 160);
  selected_override_id uuid;
  quote jsonb;
  saved_snapshot public.commercial_product_yield_sale_snapshots%rowtype;
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem registrar o snapshot financeiro da venda';
  end if;
  if operation_key is null then
    raise exception 'Chave idempotente obrigatória para registrar a venda';
  end if;
  if normalized_context_type not in ('action', 'event') then
    raise exception 'Contexto inválido: use ação ou evento';
  end if;
  if length(normalized_context_key) not between 2 and 80 then
    raise exception 'Contexto da venda inválido';
  end if;
  if length(normalized_sale_reference) not between 2 and 160 then
    raise exception 'Referência da venda inválida';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('commercial-product-yield-snapshot:' || operation_key::text, 0)
  );

  select snapshot.*
  into saved_snapshot
  from public.commercial_product_yield_sale_snapshots snapshot
  where snapshot.snapshot_key = operation_key;

  if saved_snapshot.id is not null then
    if saved_snapshot.product_id <> target_product_id
      or saved_snapshot.context_type <> normalized_context_type
      or saved_snapshot.context_key <> normalized_context_key
      or saved_snapshot.sale_reference <> normalized_sale_reference
    then
      raise exception 'Chave idempotente já usada por outra venda ou contexto';
    end if;
    return to_jsonb(saved_snapshot) || jsonb_build_object('idempotent', true);
  end if;

  select setting.id
  into selected_override_id
  from public.commercial_product_yield_overrides setting
  where setting.product_id = target_product_id
    and setting.context_type = normalized_context_type
    and setting.context_key = normalized_context_key
    and setting.active
    and setting.valid_from <= now()
    and (setting.valid_until is null or setting.valid_until > now())
  limit 1;

  if selected_override_id is null then
    raise exception 'Não existe rendimento ativo para esta ação ou evento';
  end if;

  quote := private.commercial_product_slice_quote_json(
    target_product_id,
    selected_override_id
  );

  insert into public.commercial_product_yield_sale_snapshots(
    snapshot_key,
    sale_reference,
    product_id,
    override_id,
    context_type,
    context_key,
    context_label,
    yield_label,
    standard_yield_quantity,
    applied_yield_quantity,
    total_cost,
    cost_per_slice,
    authorized_slice_price,
    projected_total_revenue,
    gross_profit_per_slice,
    projected_gross_profit,
    margin,
    markup,
    minimum_margin,
    margin_alert,
    cost_origin,
    data_status,
    recipe_version_id,
    cost_snapshot_id,
    calculation_snapshot,
    captured_by
  ) values (
    operation_key,
    normalized_sale_reference,
    target_product_id,
    selected_override_id,
    quote->>'context_type',
    quote->>'context_key',
    quote->>'context_label',
    quote->>'yield_label',
    (quote->>'standard_yield_quantity')::numeric,
    (quote->>'applied_yield_quantity')::numeric,
    (quote->>'total_cost')::numeric,
    (quote->>'cost_per_slice')::numeric,
    (quote->>'authorized_slice_price')::numeric,
    (quote->>'projected_total_revenue')::numeric,
    (quote->>'gross_profit_per_slice')::numeric,
    (quote->>'projected_gross_profit')::numeric,
    (quote->>'margin')::numeric,
    (quote->>'markup')::numeric,
    (quote->>'minimum_margin')::numeric,
    (quote->>'margin_alert')::boolean,
    quote->>'cost_origin',
    quote->>'data_status',
    nullif(quote->>'recipe_version_id', '')::uuid,
    nullif(quote->>'cost_snapshot_id', '')::uuid,
    jsonb_build_object(
      'schema_version', 1,
      'calculation_source', 'commercial_product_slice_quote_v1',
      'sale_reference', normalized_sale_reference,
      'product_id', target_product_id,
      'yield_override', jsonb_build_object(
        'id', quote->'override_id',
        'context_type', quote->'context_type',
        'context_key', quote->'context_key',
        'context_label', quote->'context_label',
        'active', quote->'active',
        'valid_from', quote->'valid_from',
        'valid_until', quote->'valid_until'
      ),
      'standard_yield_quantity', quote->'standard_yield_quantity',
      'applied_yield_quantity', quote->'applied_yield_quantity',
      'yield_label', quote->'yield_label',
      'total_cost', quote->'total_cost',
      'cost_per_slice', quote->'cost_per_slice',
      'authorized_slice_price', quote->'authorized_slice_price',
      'projected_total_revenue', quote->'projected_total_revenue',
      'gross_profit_per_slice', quote->'gross_profit_per_slice',
      'projected_gross_profit', quote->'projected_gross_profit',
      'margin', quote->'margin',
      'markup', quote->'markup',
      'minimum_margin', quote->'minimum_margin',
      'margin_alert', quote->'margin_alert',
      'cost_origin', quote->'cost_origin',
      'data_status', quote->'data_status',
      'recipe_version_id', quote->'recipe_version_id',
      'cost_snapshot_id', quote->'cost_snapshot_id',
      'captured_at', to_jsonb(now())
    ),
    (select auth.uid())
  )
  returning * into saved_snapshot;

  return to_jsonb(saved_snapshot) || jsonb_build_object('idempotent', false);
end;
$$;

revoke all on function private.commercial_product_slice_quote_json(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.commercial_product_yield_overrides_json(uuid)
  from public, anon, authenticated;
revoke all on function private.prevent_commercial_product_yield_snapshot_mutation()
  from public, anon, authenticated;
revoke all on function public.manager_get_product_profitability_workspace(text, uuid)
  from public, anon, authenticated;
revoke all on function public.manager_save_product_yield_override(
  uuid, uuid, text, text, text, numeric, numeric, boolean, timestamptz, timestamptz
) from public, anon, authenticated;
revoke all on function public.manager_capture_product_yield_sale_snapshot(
  uuid, text, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.manager_get_product_profitability_workspace(text, uuid)
  to authenticated;
grant execute on function public.manager_save_product_yield_override(
  uuid, uuid, text, text, text, numeric, numeric, boolean, timestamptz, timestamptz
) to authenticated;
grant execute on function public.manager_capture_product_yield_sale_snapshot(
  uuid, text, text, text, uuid
) to authenticated;

comment on table public.commercial_product_yield_overrides is
  'Rendimento e preço por fatia autorizados para uma ação ou evento, sem duplicar o produto comercial.';
comment on table public.commercial_product_yield_sale_snapshots is
  'Snapshot imutável do rendimento, contexto, custo e preço usados em uma venda por fatia.';
comment on function public.manager_save_product_yield_override(
  uuid, uuid, text, text, text, numeric, numeric, boolean, timestamptz, timestamptz
) is 'Configura rendimento e preço por fatia de uma ação ou evento e recalcula a rentabilidade no servidor.';
comment on function public.manager_capture_product_yield_sale_snapshot(
  uuid, text, text, text, uuid
) is 'Registra de forma idempotente o snapshot financeiro imutável usado na venda por fatia.';

commit;
