begin;

create or replace function private.configurable_positive_integer(
  target_value text,
  fallback_value integer
)
returns integer
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  parsed_value integer;
begin
  begin
    parsed_value := target_value::integer;
  exception when others then
    return fallback_value;
  end;
  return case when parsed_value > 0 then parsed_value else fallback_value end;
end;
$$;

create or replace function private.configurable_nonnegative_numeric(
  target_value text,
  fallback_value numeric
)
returns numeric
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  parsed_value numeric;
begin
  begin
    parsed_value := target_value::numeric;
  exception when others then
    return fallback_value;
  end;
  return case when parsed_value >= 0 then parsed_value else fallback_value end;
end;
$$;

revoke all on function private.configurable_positive_integer(text,integer)
  from public, anon, authenticated;
revoke all on function private.configurable_nonnegative_numeric(text,numeric)
  from public, anon, authenticated;

create or replace function private.redact_internal_product_configuration(target_value jsonb)
returns jsonb
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  redacted jsonb;
begin
  if target_value is null then return null; end if;

  case jsonb_typeof(target_value)
    when 'object' then
      select coalesce(
        jsonb_object_agg(entry.key, private.redact_internal_product_configuration(entry.value)),
        '{}'::jsonb
      )
      into redacted
      from jsonb_each(target_value) entry
      where entry.key not in (
        'unit_cost',
        'internal_cost',
        'estimated_internal_cost',
        'total_cost',
        'gross_profit',
        'margin',
        'markup',
        'minimum_margin',
        'margin_alert',
        'cost_origin',
        'cost_snapshot_id',
        'recipe_version_id'
      );
      return redacted;
    when 'array' then
      select coalesce(
        jsonb_agg(private.redact_internal_product_configuration(entry.value) order by entry.ordinality),
        '[]'::jsonb
      )
      into redacted
      from jsonb_array_elements(target_value) with ordinality entry(value, ordinality);
      return redacted;
    else
      return target_value;
  end case;
end;
$$;

revoke all on function private.redact_internal_product_configuration(jsonb)
  from public, anon, authenticated;

create or replace function private.canonicalize_configurable_product_selection(
  target_product_id uuid,
  target_quantity integer,
  requested_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row public.commercial_products%rowtype;
  rules jsonb;
  configuration jsonb;
  pricing_tiers jsonb;
  matched_tier jsonb;
  package_quantities text;
  item jsonb;
  option_row public.commercial_product_options%rowtype;
  option_id uuid;
  option_quantity integer;
  canonical_items jsonb := '[]'::jsonb;
  summary_items jsonb := '[]'::jsonb;
  selected_ids uuid[] := '{}'::uuid[];
  flavor_count integer := 0;
  flavor_quantity integer := 0;
  total_price_adjustment numeric(14,2) := 0;
  total_internal_cost numeric(14,4) := 0;
  maximum_flavors integer;
  minimum_per_flavor integer;
  minimum_total integer;
  maximum_total integer;
  require_exact_total boolean;
  allow_addons boolean;
  included_quantity integer;
  additional_units integer;
  additional_unit_price numeric(14,2);
  base_price numeric(14,2);
  group_rule record;
  group_limit integer;
  group_minimum integer;
  selected_in_group integer;
begin
  select product.* into product_row
  from public.commercial_products product
  where product.id = target_product_id
    and product.active
    and product.published;

  if product_row.id is null then raise exception 'Produto indisponível'; end if;
  if product_row.customization_mode = 'cake_builder' then return null; end if;
  if product_row.product_type not in ('sweet','cookie','school_kit','fixed') then
    raise exception 'Tipo de produto incompatível com este fluxo';
  end if;
  if coalesce(target_quantity, 0) < product_row.minimum_quantity then
    raise exception 'A quantidade mínima é %', product_row.minimum_quantity;
  end if;

  rules := case
    when jsonb_typeof(product_row.configuration_rules) = 'object'
      then product_row.configuration_rules
    else '{}'::jsonb
  end;
  minimum_total := greatest(
    product_row.minimum_quantity,
    private.configurable_positive_integer(rules->>'minimumTotalQuantity', product_row.minimum_quantity)
  );
  maximum_total := greatest(
    minimum_total,
    private.configurable_positive_integer(rules->>'maximumTotalQuantity', 10000)
  );
  if target_quantity < minimum_total then raise exception 'A quantidade mínima é %', minimum_total; end if;
  if target_quantity > maximum_total then raise exception 'A quantidade máxima é %', maximum_total; end if;

  maximum_flavors := least(
    private.configurable_positive_integer(rules->>'maximumFlavors', 100),
    100
  );
  minimum_per_flavor := private.configurable_positive_integer(rules->>'minimumQuantityPerFlavor', 1);
  require_exact_total := coalesce((rules->>'requireExactTotal')::boolean, false);
  allow_addons := coalesce((rules->>'allowAddons')::boolean, true);
  included_quantity := greatest(
    product_row.minimum_quantity,
    private.configurable_positive_integer(rules->>'includedQuantity', product_row.minimum_quantity)
  );
  additional_unit_price := private.configurable_nonnegative_numeric(rules->>'additionalUnitPrice', 0);

  pricing_tiers := case
    when jsonb_typeof(rules->'priceTiers') = 'array' then rules->'priceTiers'
    else '[]'::jsonb
  end;

  if jsonb_array_length(pricing_tiers) > 0 then
    select tier.value into matched_tier
    from jsonb_array_elements(pricing_tiers) tier(value)
    where private.configurable_positive_integer(tier.value->>'quantity', 0) = target_quantity
      and private.configurable_nonnegative_numeric(tier.value->>'price', -1) >= 0
    limit 1;

    if matched_tier is null then
      select string_agg(quantity::text, ', ' order by quantity)
      into package_quantities
      from (
        select distinct private.configurable_positive_integer(tier.value->>'quantity', 0) as quantity
        from jsonb_array_elements(pricing_tiers) tier(value)
      ) available
      where quantity > 0;
      raise exception 'Escolha um dos pacotes disponíveis: % unidade(s)', coalesce(package_quantities, 'nenhum');
    end if;

    base_price := round(private.configurable_nonnegative_numeric(matched_tier->>'price', 0), 2);
    maximum_flavors := least(
      private.configurable_positive_integer(matched_tier->>'maximumFlavors', maximum_flavors),
      100
    );
  else
    additional_units := greatest(0, target_quantity - included_quantity);
    base_price := round(
      greatest(coalesce(product_row.base_price, 0), 0) + additional_units * additional_unit_price,
      2
    );
  end if;

  if product_row.customization_mode = 'none' then
    return jsonb_build_object(
      'product_id', product_row.id,
      'product_type', product_row.product_type,
      'configuration_mode', product_row.customization_mode,
      'selection', jsonb_build_object(
        'schema_version', 2,
        'product', jsonb_build_object(
          'id', product_row.id,
          'slug', product_row.slug,
          'name', product_row.name,
          'product_type', product_row.product_type,
          'customization_mode', product_row.customization_mode,
          'requested_quantity', target_quantity
        ),
        'items', '[]'::jsonb,
        'pricing', jsonb_build_object(
          'base_price', base_price,
          'price_adjustment', 0,
          'estimated_price', base_price,
          'estimated_internal_cost', 0
        )
      ),
      'summary', '[]'::jsonb,
      'selected_flavor_count', 0,
      'configured_quantity', 0,
      'base_price', base_price,
      'price_adjustment', 0,
      'estimated_internal_cost', 0,
      'estimated_price', base_price
    );
  end if;

  configuration := coalesce(requested_selections, '{}'::jsonb)->'product_configuration';
  if configuration is null or jsonb_typeof(configuration) <> 'object' then
    raise exception 'Escolha as opções do produto antes de enviar a encomenda';
  end if;
  if jsonb_typeof(configuration->'items') <> 'array' then
    raise exception 'A configuração do produto precisa conter uma lista de escolhas';
  end if;
  if jsonb_array_length(configuration->'items') > 100 then
    raise exception 'A configuração excede o limite de opções';
  end if;

  for item in select value from jsonb_array_elements(configuration->'items') loop
    begin
      option_id := nullif(item->>'option_id','')::uuid;
    exception when invalid_text_representation then
      raise exception 'Opção inválida';
    end;
    begin
      option_quantity := coalesce(nullif(item->>'quantity','')::integer, 0);
    exception when invalid_text_representation then
      raise exception 'Quantidade de opção inválida';
    end;
    if option_id is null or option_quantity <= 0 then raise exception 'Opção ou quantidade inválida'; end if;
    if option_id = any(selected_ids) then raise exception 'Opção repetida na configuração'; end if;

    select option.* into option_row
    from public.commercial_product_options option
    where option.id = option_id
      and option.product_id = product_row.id
      and option.active
      and option.published;
    if option_row.id is null then raise exception 'Uma opção selecionada está indisponível'; end if;
    if option_quantity < option_row.minimum_quantity then
      raise exception '% exige pelo menos % unidade(s)', option_row.label, option_row.minimum_quantity;
    end if;
    if option_row.maximum_quantity is not null and option_quantity > option_row.maximum_quantity then
      raise exception '% permite no máximo % unidade(s)', option_row.label, option_row.maximum_quantity;
    end if;
    if option_row.option_kind = 'addon' and not allow_addons then
      raise exception 'Este produto não aceita adicionais';
    end if;

    selected_ids := selected_ids || option_id;
    if option_row.option_kind = 'flavor' then
      flavor_count := flavor_count + 1;
      flavor_quantity := flavor_quantity + option_quantity;
      if option_quantity < minimum_per_flavor then
        raise exception 'Cada sabor precisa ter pelo menos % unidade(s)', minimum_per_flavor;
      end if;
    end if;

    total_price_adjustment := total_price_adjustment + option_row.price_adjustment * option_quantity;
    total_internal_cost := total_internal_cost + option_row.unit_cost * option_quantity;
    canonical_items := canonical_items || jsonb_build_array(jsonb_build_object(
      'option_id', option_row.id,
      'option_code', option_row.option_code,
      'option_kind', option_row.option_kind,
      'group_key', option_row.group_key,
      'label', option_row.label,
      'quantity', option_quantity,
      'unit_price_adjustment', option_row.price_adjustment,
      'unit_cost', option_row.unit_cost,
      'price_adjustment', option_row.price_adjustment * option_quantity,
      'internal_cost', option_row.unit_cost * option_quantity
    ));
    summary_items := summary_items || jsonb_build_array(option_quantity::text || '× ' || option_row.label);
  end loop;

  if flavor_count > maximum_flavors then raise exception 'Escolha no máximo % sabor(es)', maximum_flavors; end if;
  if flavor_quantity > maximum_total then raise exception 'A configuração excede % unidade(s)', maximum_total; end if;
  if product_row.product_type = 'sweet' and flavor_quantity < minimum_total then
    raise exception 'Distribua pelo menos % unidade(s) entre os sabores', minimum_total;
  end if;
  if require_exact_total and flavor_quantity <> target_quantity then
    raise exception 'Distribua exatamente % unidade(s) entre os sabores', target_quantity;
  end if;

  if jsonb_typeof(rules->'groupLimits') = 'object' then
    for group_rule in select key, value from jsonb_each_text(rules->'groupLimits') loop
      group_limit := private.configurable_positive_integer(group_rule.value, 0);
      if group_limit > 0 then
        select count(*) into selected_in_group
        from jsonb_array_elements(canonical_items) configured(item)
        where configured.item->>'group_key' = group_rule.key;
        if selected_in_group > group_limit then
          raise exception 'Escolha no máximo % opção(ões) em %', group_limit, replace(group_rule.key, '_', ' ');
        end if;
      end if;
    end loop;
  end if;

  if jsonb_typeof(rules->'groupMinimums') = 'object' then
    for group_rule in select key, value from jsonb_each_text(rules->'groupMinimums') loop
      group_minimum := private.configurable_positive_integer(group_rule.value, 0);
      if group_minimum > 0 then
        select count(*) into selected_in_group
        from jsonb_array_elements(canonical_items) configured(item)
        where configured.item->>'group_key' = group_rule.key;
        if selected_in_group < group_minimum then
          raise exception 'Escolha pelo menos % opção(ões) em %', group_minimum, replace(group_rule.key, '_', ' ');
        end if;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'product_id', product_row.id,
    'product_type', product_row.product_type,
    'configuration_mode', product_row.customization_mode,
    'selection', jsonb_build_object(
      'schema_version', 2,
      'product', jsonb_build_object(
        'id', product_row.id,
        'slug', product_row.slug,
        'name', product_row.name,
        'product_type', product_row.product_type,
        'customization_mode', product_row.customization_mode,
        'requested_quantity', target_quantity
      ),
      'items', canonical_items,
      'pricing', jsonb_build_object(
        'base_price', base_price,
        'price_adjustment', round(total_price_adjustment, 2),
        'estimated_price', round(base_price + total_price_adjustment, 2),
        'estimated_internal_cost', round(total_internal_cost, 4)
      )
    ),
    'summary', summary_items,
    'selected_flavor_count', flavor_count,
    'configured_quantity', flavor_quantity,
    'base_price', base_price,
    'price_adjustment', round(total_price_adjustment, 2),
    'estimated_internal_cost', round(total_internal_cost, 4),
    'estimated_price', round(base_price + total_price_adjustment, 2)
  );
end;
$$;

revoke all on function private.canonicalize_configurable_product_selection(uuid,integer,jsonb)
  from public, anon, authenticated;

create or replace function public.get_configurable_product_catalog(target_segment text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', product.id,
    'slug', product.slug,
    'segment', product.segment,
    'name', product.name,
    'short_description', product.short_description,
    'base_price', product.base_price,
    'minimum_quantity', product.minimum_quantity,
    'lead_business_days', product.lead_business_days,
    'product_type', product.product_type,
    'customization_mode', product.customization_mode,
    'configuration_rules', jsonb_strip_nulls(jsonb_build_object(
      'minimumTotalQuantity', product.configuration_rules->'minimumTotalQuantity',
      'maximumTotalQuantity', product.configuration_rules->'maximumTotalQuantity',
      'maximumFlavors', product.configuration_rules->'maximumFlavors',
      'minimumQuantityPerFlavor', product.configuration_rules->'minimumQuantityPerFlavor',
      'requireExactTotal', product.configuration_rules->'requireExactTotal',
      'allowAddons', product.configuration_rules->'allowAddons',
      'priceTiers', product.configuration_rules->'priceTiers',
      'includedQuantity', product.configuration_rules->'includedQuantity',
      'additionalUnitPrice', product.configuration_rules->'additionalUnitPrice',
      'groupLimits', product.configuration_rules->'groupLimits',
      'groupMinimums', product.configuration_rules->'groupMinimums'
    )),
    'image_url', product.image_url,
    'published', product.published,
    'active', product.active,
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', option.id,
        'product_id', option.product_id,
        'group_key', option.group_key,
        'option_code', option.option_code,
        'option_kind', option.option_kind,
        'label', option.label,
        'price_adjustment', option.price_adjustment,
        'unit_cost', 0,
        'minimum_quantity', option.minimum_quantity,
        'maximum_quantity', option.maximum_quantity,
        'active', option.active,
        'published', option.published,
        'sort_order', option.sort_order
      ) order by option.sort_order, option.label)
      from public.commercial_product_options option
      where option.product_id = product.id and option.active and option.published
    ), '[]'::jsonb)
  ) order by product.sort_order, product.name), '[]'::jsonb)
  from public.commercial_products product
  where product.segment = target_segment and product.active and product.published;
$$;

revoke all on function public.get_configurable_product_catalog(text) from public;
grant execute on function public.get_configurable_product_catalog(text) to anon, authenticated, service_role;

create or replace function private.capture_service_request_pricing_snapshot(
  target_request_id uuid,
  target_product_id uuid,
  target_quantity integer,
  target_selections jsonb default '{}'::jsonb,
  target_configuration_quote jsonb default null
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
    when jsonb_typeof(target_configuration_quote) = 'object' then target_configuration_quote
    else null
  end;
  effective_total_cost numeric(14,4);
  cost_per_yield numeric(14,4);
  effective_sale_price numeric(14,2);
  catalog_base_price numeric(14,2);
  quote_estimated_price numeric(16,2) := 0;
  quote_option_cost numeric(16,4) := 0;
  quote_price_adjustment numeric(16,2) := 0;
  resolved_base_cost numeric(16,4);
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
    select 1 from public.service_request_pricing_snapshots snapshot
    where snapshot.request_id = target_request_id
  ) then return false; end if;

  profitability := private.commercial_product_profitability_json(target_product_id);
  if profitability is null then raise exception 'Rentabilidade do produto não configurada'; end if;

  effective_total_cost := round(greatest(coalesce((profitability->>'effective_total_cost')::numeric, 0), 0), 4);
  cost_per_yield := round(greatest(coalesce((profitability->>'cost_per_yield')::numeric, 0), 0), 4);
  effective_sale_price := round(greatest(coalesce((profitability->>'effective_sale_price')::numeric, 0), 0), 2);
  catalog_base_price := round(greatest(coalesce((profitability->>'base_price')::numeric, 0), 0), 2);

  if normalized_quote is not null then
    quote_estimated_price := round(greatest(coalesce((normalized_quote->>'estimated_price')::numeric, 0), 0), 2);
    quote_option_cost := round(greatest(coalesce((normalized_quote->>'estimated_internal_cost')::numeric, 0), 0), 4);
    quote_price_adjustment := round(
      greatest(
        coalesce((normalized_quote->>'price_adjustment')::numeric, quote_estimated_price - catalog_base_price),
        0
      ),
      2
    );
    resolved_base_cost := case
      when profitability->>'segment' = 'cakes' then effective_total_cost
      else cost_per_yield * target_quantity
    end;
    resolved_total_cost := round(resolved_base_cost + quote_option_cost, 4);
    resolved_total_price := quote_estimated_price;
    resolved_unit_cost := round(resolved_total_cost / target_quantity, 4);
    resolved_unit_price := round(resolved_total_price / target_quantity, 2);
  else
    resolved_unit_cost := case
      when cost_per_yield > 0 then cost_per_yield
      else effective_total_cost
    end;
    resolved_unit_price := effective_sale_price;
    resolved_total_cost := round(resolved_unit_cost * target_quantity, 4);
    resolved_total_price := round(resolved_unit_price * target_quantity, 2);
  end if;

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
    request_id, product_id, requested_quantity, unit_cost, unit_price,
    total_cost, total_price, gross_profit, margin, markup, minimum_margin,
    margin_alert, cost_origin, data_status, recipe_version_id,
    cost_snapshot_id, selection_snapshot, calculation_snapshot, created_by
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
      'schema_version', 2,
      'calculation_source', 'commercial_product_profitability_v2',
      'product', jsonb_build_object(
        'id', profitability->'id',
        'name', profitability->'name',
        'slug', profitability->'slug',
        'segment', profitability->'segment'
      ),
      'effective_total_cost', effective_total_cost,
      'cost_per_yield', cost_per_yield,
      'effective_sale_price', effective_sale_price,
      'configuration_option_cost', quote_option_cost,
      'configuration_price_adjustment', quote_price_adjustment,
      'configuration_quote', normalized_quote,
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

revoke all on function private.capture_service_request_pricing_snapshot(uuid,uuid,integer,jsonb,jsonb)
  from public, anon, authenticated;

create or replace function public.staff_get_service_request_workspace(
  search_text text default '',
  requested_status text default null,
  result_limit integer default 80
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_search text := lower(btrim(coalesce(search_text, '')));
  normalized_status text := nullif(lower(btrim(coalesce(requested_status, ''))), '');
  safe_limit integer := greatest(1, least(coalesce(result_limit, 80), 100));
  manager_access boolean := private.is_manager();
begin
  if (select auth.uid()) is null or not exists (
    select 1
    from public.staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.active
      and (
        staff.role::text in ('owner', 'manager')
        or exists (
          select 1
          from public.staff_store_assignments assignment
          where assignment.staff_user_id = staff.user_id
            and assignment.active
            and assignment.can_manage_orders
        )
      )
  ) then raise exception 'Acesso às encomendas não autorizado'; end if;

  if normalized_status is not null and normalized_status not in (
    'prebooked', 'quoted', 'awaiting_deposit', 'confirmed', 'in_production',
    'ready', 'completed', 'cancelled', 'expired'
  ) then raise exception 'Situação de encomenda inválida'; end if;

  return coalesce((
    select jsonb_agg(scoped.payload order by scoped.priority, scoped.desired_start, scoped.created_at desc)
    from (
      select
        case request.status
          when 'confirmed' then 1 when 'in_production' then 2 when 'ready' then 3
          when 'awaiting_deposit' then 4 when 'quoted' then 5 when 'prebooked' then 6
          else 20
        end as priority,
        request.desired_start,
        request.created_at,
        jsonb_build_object(
          'id', request.id,
          'request_number', request.request_number,
          'profile_id', request.profile_id,
          'status', request.status,
          'source', request.source,
          'customer_name', request.customer_name,
          'customer_phone', request.customer_phone,
          'customer_email', request.customer_email,
          'quantity', request.quantity,
          'desired_start', request.desired_start,
          'desired_end', request.desired_end,
          'service_location', request.service_location,
          'customer_notes', request.customer_notes,
          'internal_notes', request.internal_notes,
          'quoted_total', request.quoted_total,
          'deposit_amount', request.deposit_amount,
          'deposit_paid_at', request.deposit_paid_at,
          'expires_at', request.expires_at,
          'created_at', request.created_at,
          'updated_at', request.updated_at,
          'product', jsonb_build_object(
            'id', product.id,
            'name', product.name,
            'segment', product.segment,
            'product_type', product.product_type,
            'customization_mode', product.customization_mode,
            'image_url', product.image_url,
            'base_price', product.base_price
          ),
          'configuration', case
            when cake.request_id is not null then jsonb_build_object(
              'kind', 'cake',
              'summary', cake.selection_summary,
              'selection', cake.canonical_selection,
              'estimated_price', cake.estimated_price,
              'estimated_internal_cost', case when manager_access then cake.estimated_internal_cost else null end
            )
            when configured.request_id is not null then jsonb_build_object(
              'kind', configured.product_type,
              'summary', configured.selection_summary,
              'selection', case
                when manager_access then configured.canonical_selection
                else private.redact_internal_product_configuration(configured.canonical_selection)
              end,
              'estimated_price', configured.estimated_price,
              'estimated_internal_cost', case when manager_access then configured.estimated_internal_cost else null end
            )
            else jsonb_build_object(
              'kind', coalesce(product.product_type, 'fixed'),
              'summary', coalesce(request.selections->'preferences', '[]'::jsonb),
              'selection', private.redact_internal_product_configuration(request.selections),
              'estimated_price', coalesce(request.quoted_total, product.base_price),
              'estimated_internal_cost', null
            )
          end,
          'pricing', case
            when pricing.request_id is null then null
            when manager_access then jsonb_build_object(
              'total_price', pricing.total_price,
              'total_cost', pricing.total_cost,
              'gross_profit', pricing.gross_profit,
              'margin', pricing.margin,
              'markup', pricing.markup,
              'minimum_margin', pricing.minimum_margin,
              'margin_alert', pricing.margin_alert,
              'data_status', pricing.data_status,
              'captured_at', pricing.captured_at
            )
            else jsonb_build_object(
              'total_price', pricing.total_price,
              'margin_alert', pricing.margin_alert,
              'data_status', pricing.data_status,
              'captured_at', pricing.captured_at
            )
          end
        ) as payload
      from public.service_requests request
      join public.commercial_products product on product.id = request.product_id
      left join public.service_request_cake_builds cake on cake.request_id = request.id
      left join public.service_request_product_configurations configured on configured.request_id = request.id
      left join public.service_request_pricing_snapshots pricing on pricing.request_id = request.id
      where (normalized_status is null or request.status = normalized_status)
        and (
          normalized_search = ''
          or lower(concat_ws(' ', request.request_number, request.customer_name,
            request.customer_phone, coalesce(request.customer_email, ''), product.name,
            coalesce(request.customer_notes, ''))) like '%' || normalized_search || '%'
        )
      order by priority, request.desired_start, request.created_at desc
      limit safe_limit
    ) scoped
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.staff_get_service_request_workspace(text,text,integer)
  from public, anon, authenticated;
grant execute on function public.staff_get_service_request_workspace(text,text,integer)
  to authenticated;

create or replace function public.staff_get_customer_service_request_history(
  target_profile_id uuid,
  result_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile_row public.profiles%rowtype;
  normalized_phone text;
  safe_limit integer := greatest(1, least(coalesce(result_limit, 30), 50));
begin
  if (select auth.uid()) is null or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso ao histórico de encomendas não autorizado';
  end if;
  select profile.* into profile_row from public.profiles profile where profile.id = target_profile_id;
  if profile_row.id is null then raise exception 'Cliente não encontrado'; end if;
  normalized_phone := regexp_replace(coalesce(profile_row.phone_e164, ''), '[^0-9]', '', 'g');

  return coalesce((
    select jsonb_agg(history.payload order by history.created_at desc)
    from (
      select
        request.created_at,
        jsonb_build_object(
          'id', request.id,
          'request_number', request.request_number,
          'status', request.status,
          'source', request.source,
          'quantity', request.quantity,
          'desired_start', request.desired_start,
          'created_at', request.created_at,
          'product', jsonb_build_object(
            'id', product.id,
            'name', product.name,
            'product_type', product.product_type,
            'image_url', product.image_url
          ),
          'configuration', case
            when cake.request_id is not null then jsonb_build_object(
              'kind', 'cake',
              'summary', cake.selection_summary,
              'selection', cake.canonical_selection,
              'estimated_price', cake.estimated_price
            )
            when configured.request_id is not null then jsonb_build_object(
              'kind', configured.product_type,
              'summary', configured.selection_summary,
              'selection', private.redact_internal_product_configuration(configured.canonical_selection),
              'estimated_price', configured.estimated_price
            )
            else jsonb_build_object(
              'kind', coalesce(product.product_type, 'fixed'),
              'summary', coalesce(request.selections->'preferences', '[]'::jsonb),
              'selection', private.redact_internal_product_configuration(request.selections),
              'estimated_price', coalesce(pricing.total_price, request.quoted_total, product.base_price)
            )
          end
        ) as payload
      from public.service_requests request
      join public.commercial_products product on product.id = request.product_id
      left join public.service_request_cake_builds cake on cake.request_id = request.id
      left join public.service_request_product_configurations configured on configured.request_id = request.id
      left join public.service_request_pricing_snapshots pricing on pricing.request_id = request.id
      where request.profile_id = target_profile_id
        or (
          normalized_phone <> ''
          and regexp_replace(coalesce(request.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone
        )
      order by request.created_at desc
      limit safe_limit
    ) history
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.staff_get_customer_service_request_history(uuid,integer)
  from public, anon, authenticated;
grant execute on function public.staff_get_customer_service_request_history(uuid,integer)
  to authenticated;

comment on function private.redact_internal_product_configuration(jsonb) is
  'Remove custos, margens e referências financeiras internas de snapshots exibidos fora do perfil gerencial.';
comment on function public.staff_get_customer_service_request_history(uuid,integer) is
  'Entrega ao CRM as encomendas estruturadas vinculadas ao perfil ou ao WhatsApp do cliente.';

commit;
