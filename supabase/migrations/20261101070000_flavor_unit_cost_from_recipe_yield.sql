begin;

-- Pedido do proprietário em 01/11/2026: o sistema já sabe o custo total da
-- torta inteira G (soma dos ingredientes da ficha técnica, função já
-- existente private.topoint_recipe_cost) e já sabe quantas fatias ela rende
-- (costing_recipe_versions.yield_quantity, ex.: 13). custo_por_fatia =
-- custo_da_torta / rendimento. Essa conta não existia em lugar nenhum:
-- flavor_costs.unit_cost era 100% digitado manualmente, por isso quase
-- nenhuma venda tinha cobertura de custo (CMV sempre 0 na Gestão).
--
-- Fonte única: esta função NUNCA grava uma cópia do custo calculado. Ela
-- só lê, na hora, os insumos/preços já cadastrados na ficha técnica. Quando
-- a ficha não existe ou está incompleta (insumo sem preço, unidade
-- incompatível etc.), cai para o valor manual de flavor_costs.unit_cost
-- (que continua existindo como reserva, não como fonte duplicada).
create or replace function public.flavor_effective_unit_cost(target_flavor_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  with recipe as (
    select v.id, v.yield_quantity, private.topoint_recipe_cost(v.id) as cost
    from public.costing_recipes r
    join public.costing_recipe_versions v on v.recipe_id = r.id
    where r.flavor_id = target_flavor_id and r.active and r.recipe_kind = 'final_product'
      and v.size_code = 'G' and v.yield_quantity > 0 and v.yield_unit = 'slice'
    order by v.version_number desc, v.created_at desc, v.id
    limit 1
  )
  select coalesce(
    (select round((cost->>'amount')::numeric / yield_quantity, 6) from recipe where (cost->>'amount') is not null),
    (select c.unit_cost from public.flavor_costs c where c.flavor_id = target_flavor_id)
  );
$$;
revoke all on function public.flavor_effective_unit_cost(uuid) from public, anon;
grant execute on function public.flavor_effective_unit_cost(uuid) to authenticated;

-- Evidência de venda (snapshot imutável): agora prefere o custo calculado da
-- receita; só cai para o valor manual quando a ficha não cobre o sabor.
create or replace function private.snapshot_instant_order_item_cost()
returns trigger
language plpgsql security definer set search_path = ''
as $function$
declare
  table_price numeric;
  current_cost numeric;
  source_updated_at timestamptz;
  recipe_context jsonb;
  recipe_version_id uuid;
  recipe_yield_quantity numeric;
  recipe_total_cost numeric;
  cost_source jsonb;
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

  select f.base_price into table_price from public.flavors f where f.id = new.flavor_id;

  select v.id, v.yield_quantity, jsonb_build_object(
    'recipe_id', r.id,
    'recipe_version_id', v.id,
    'version_number', v.version_number,
    'size_code', v.size_code,
    'yield_quantity', v.yield_quantity,
    'yield_unit', v.yield_unit,
    'classification_scope', 'direct_components_only',
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
  ) into recipe_version_id, recipe_yield_quantity, recipe_context
  from public.costing_recipes r
  join public.costing_recipe_versions v on v.recipe_id = r.id
  where r.flavor_id = new.flavor_id and r.active
    and r.recipe_kind = 'final_product' and v.size_code = 'G'
  order by v.version_number desc, v.created_at desc, v.id
  limit 1;

  if recipe_version_id is not null and coalesce(recipe_yield_quantity, 0) > 0 then
    recipe_total_cost := (private.topoint_recipe_cost(recipe_version_id)->>'amount')::numeric;
  end if;

  if recipe_total_cost is not null then
    current_cost := round(recipe_total_cost / recipe_yield_quantity, 6);
    cost_source := jsonb_build_object(
      'table', 'public.costing_recipe_versions', 'recipe_version_id', recipe_version_id,
      'whole_cake_cost', recipe_total_cost, 'yield_quantity', recipe_yield_quantity, 'yield_unit', 'slice'
    );
  else
    select c.unit_cost, c.updated_at into current_cost, source_updated_at
    from public.flavor_costs c where c.flavor_id = new.flavor_id;
    cost_source := jsonb_build_object(
      'table', 'public.flavor_costs', 'column', 'unit_cost',
      'flavor_id', new.flavor_id, 'updated_at', source_updated_at
    );
  end if;

  -- A cobertura/custo da ficha técnica pode mudar depois (preço de insumo
  -- reajustado, ficha completada); a venda já aconteceu com o custo de
  -- agora. Confiança historical é sobre "capturamos um custo real no
  -- momento da venda", não sobre a ficha nunca mudar.
  confidence := case when current_cost is null then 'missing' else 'historical' end;
  breakdown := jsonb_build_object(
    'schema_version', 2,
    'captured_at', captured_at,
    'sale_source', jsonb_build_object(
      'table', 'public.instant_order_items', 'instant_order_item_id', new.id,
      'order_id', new.order_id, 'flavor_id', new.flavor_id,
      'charged_unit_price', new.unit_price
    ),
    'price_source', jsonb_build_object(
      'table', 'public.flavors', 'column', 'base_price', 'flavor_id', new.flavor_id
    ),
    'cost_source_kind', case when recipe_total_cost is not null then 'recipe' else 'manual_flavor_costs' end,
    'cost_source', cost_source,
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

-- Relatório de gestão: mesma troca nos 3 lugares que hoje leem direto de
-- flavor_costs (item vendido sem snapshot, perda de fatia, correção de
-- conferência) -- usam o custo calculado da receita quando existe.
create or replace function public.manager_management_report_v2(start_date date, end_date date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
declare
  legacy jsonb;
  previous_legacy jsonb;
  periods_report jsonb;
  current_report jsonb;
  previous_report jsonb;
  prev_start date;
  prev_end date;
begin
  if auth.uid() is null or not private.is_manager() then raise exception 'Acesso não autorizado'; end if;
  if start_date is null or end_date is null or end_date < start_date then raise exception 'Período inválido'; end if;
  if end_date - start_date + 1 > 400 then raise exception 'Escolha um período de até 400 dias'; end if;
  prev_end := start_date - 1;
  prev_start := start_date - (end_date - start_date + 1);

  legacy := public.manager_management_report(start_date, end_date);
  previous_legacy := public.manager_management_report(prev_start, prev_end);

  with periods(period_key, first_day, last_day, report) as (
    values ('current', start_date, end_date, legacy), ('previous', prev_start, prev_end, previous_legacy)
  ), done as (
    select p.period_key, o.id, o.total,
      (coalesce(o.completed_at, o.created_at) at time zone 'America/Fortaleza')::date as sale_date
    from periods p join public.instant_orders o
      on (coalesce(o.completed_at, o.created_at) at time zone 'America/Fortaleza')::date between p.first_day and p.last_day
    where o.status = 'completed'
  ), item_weights as (
    select d.period_key, d.id as order_id, d.total as order_total, i.id as item_id, i.quantity,
      case when i.is_reward then 0 else i.unit_price * i.quantity end as weight,
      case when s.instant_order_item_id is not null then s.unit_cost_snapshot else c.unit_cost end as unit_cost,
      case when s.instant_order_item_id is not null then case
        when s.unit_cost_snapshot is not null and s.cost_confidence in ('historical', 'estimated_current')
          then s.cost_confidence else 'missing' end
        when c.unit_cost is not null then 'estimated_current' else 'missing' end as confidence
    from done d join public.instant_order_items i on i.order_id = d.id
    left join private.instant_order_item_cost_snapshots s on s.instant_order_item_id = i.id
    left join lateral (select public.flavor_effective_unit_cost(i.flavor_id) as unit_cost) c on true
  ), weighted_items as (
    select *, sum(weight) over (partition by order_id) as order_weight,
      row_number() over (partition by order_id order by (weight > 0) desc, item_id) as allocation_rank
    from item_weights
  ), rounded_items as (
    select *, case when order_weight > 0 then round(round(order_total * 100) * weight / order_weight)
      else 0 end as rounded_revenue_cents
    from weighted_items
  ), effective_items as (
    select period_key, confidence, quantity as units, unit_cost,
      rounded_revenue_cents + case when allocation_rank = 1 and order_weight > 0
        then round(order_total * 100) - sum(rounded_revenue_cents) over (partition by order_id)
        else 0 end as revenue_cents
    from rounded_items
    union all
    select d.period_key, 'missing'::text, 0, null::numeric, round(d.total * 100)
    from done d
    where d.total <> 0
      and not exists (select 1 from item_weights i where i.order_id = d.id and i.weight > 0)
    union all
    select p.period_key, case when c.unit_cost is null then 'missing' else 'estimated_current' end,
      a.quantity_delta, c.unit_cost, a.quantity_delta * a.unit_price * 100
    from private.cash_sale_conference_corrections a
    join periods p on a.service_date between p.first_day and p.last_day
    left join lateral (select public.flavor_effective_unit_cost(a.flavor_id) as unit_cost) c on true
  ), exact_buckets as (
    select p.period_key, p.report, k.confidence, k.bucket_order,
      coalesce(sum(i.units), 0) as units,
      coalesce(sum(i.revenue_cents), 0) as revenue_cents,
      coalesce(sum(i.units * i.unit_cost) filter (where i.confidence in ('historical', 'estimated_current')), 0) as cost_reais,
      coalesce(bool_or(i.units <> 0 or i.revenue_cents <> 0), false) as has_activity
    from periods p cross join (values ('historical', 1), ('estimated_current', 2), ('missing', 3)) k(confidence, bucket_order)
    left join effective_items i on i.period_key = p.period_key and i.confidence = k.confidence
    group by p.period_key, p.report, k.confidence, k.bucket_order
  ), rounded_buckets as (
    select *, trunc(revenue_cents) as truncated_revenue_cents,
      round(sum(revenue_cents) over (partition by period_key))
        - sum(trunc(revenue_cents)) over (partition by period_key) as residual_cents,
      row_number() over (partition by period_key
        order by revenue_cents - trunc(revenue_cents) desc, bucket_order) as positive_rank,
      row_number() over (partition by period_key
        order by revenue_cents - trunc(revenue_cents), bucket_order) as negative_rank
    from exact_buckets
  ), buckets as (
    select period_key, report, confidence, bucket_order, units, cost_reais, has_activity,
      truncated_revenue_cents + case
        when residual_cents > 0 and positive_rank <= residual_cents then 1
        when residual_cents < 0 and negative_rank <= -residual_cents then -1
        else 0 end as revenue_cents
    from rounded_buckets
  ), bucket_totals as (
    select *, sum(revenue_cents) over (partition by period_key) as sales_cents,
      round((report #>> '{kpis,fees}')::numeric * 100) as fees_cents
    from buckets
  ), rounded_fees as (
    select *, case when sales_cents <> 0 then round(fees_cents * revenue_cents / sales_cents)
      when confidence = 'missing' then fees_cents else 0 end as rounded_fee_cents,
      row_number() over (partition by period_key order by (revenue_cents <> 0) desc, bucket_order) as fee_rank
    from bucket_totals
  ), net_buckets as (
    select *, revenue_cents - rounded_fee_cents - case when fee_rank = 1
      then fees_cents - sum(rounded_fee_cents) over (partition by period_key)
      else 0 end as net_revenue_cents
    from rounded_fees
  ), totals as (
    select period_key, report, sales_cents, fees_cents,
      sum(units) as total_units,
      sum(net_revenue_cents) as net_revenue_cents,
      sum(units) filter (where confidence in ('historical', 'estimated_current')) as covered_units,
      sum(net_revenue_cents) filter (where confidence in ('historical', 'estimated_current')) as covered_revenue_cents,
      sum(units) filter (where confidence = 'historical') as historical_units,
      sum(net_revenue_cents) filter (where confidence = 'historical') as historical_revenue_cents,
      sum(units) filter (where confidence = 'estimated_current') as estimated_units,
      sum(net_revenue_cents) filter (where confidence = 'estimated_current') as estimated_revenue_cents,
      sum(units) filter (where confidence = 'missing') as missing_units,
      sum(net_revenue_cents) filter (where confidence = 'missing') as missing_revenue_cents,
      round(sum(cost_reais) * 100) as cogs_cents,
      bool_or(confidence <> 'historical' and has_activity)
        or bool_or(confidence = 'missing' and net_revenue_cents <> 0) as is_partial,
      bool_or(confidence = 'estimated_current' and has_activity) as has_estimates,
      bool_or(confidence = 'missing' and (has_activity or net_revenue_cents <> 0)) as has_missing,
      bool_or(has_activity and confidence <> 'missing') as has_costs,
      jsonb_object_agg(confidence, jsonb_build_object('units', units, 'revenueCents', net_revenue_cents)) as coverage_buckets
    from net_buckets group by period_key, report, sales_cents, fees_cents
  ), loss_totals as (
    select p.period_key,
      round(coalesce(sum(l.quantity * c.unit_cost), 0) * 100) as losses_cents,
      count(l.id) filter (where c.unit_cost is null) as missing_loss_count,
      count(l.id) filter (where c.unit_cost is not null) as estimated_loss_count
    from periods p left join public.slice_losses l on l.service_date between p.first_day and p.last_day
    left join lateral (select public.flavor_effective_unit_cost(l.flavor_id) as unit_cost) c on true
    group by p.period_key
  ), movement_totals as (
    select p.period_key,
      round(coalesce(sum(m.amount) filter (where m.kind = 'expense'), 0) * 100) as expenses_cents,
      round(coalesce(sum(m.amount) filter (where m.kind = 'withdrawal'), 0) * 100) as withdrawals_cents,
      round(coalesce(sum(m.amount) filter (where m.kind = 'supply'), 0) * 100) as supplies_cents,
      round(coalesce(sum(case when m.direction = 'in' then m.amount else -m.amount end)
        filter (where m.kind in ('sale', 'refund')), 0) * 100) as received_cents
    from periods p left join public.cash_movements m
      on (m.created_at at time zone 'America/Fortaleza')::date between p.first_day and p.last_day
    group by p.period_key
  ), period_results as (
    select t.period_key, jsonb_build_object(
      'result', jsonb_build_object(
        'salesRevenueCents', sales_cents,
        'netRevenueCents', net_revenue_cents,
        'coveredRevenueCents', covered_revenue_cents,
        'feesEstimatedCents', fees_cents,
        'feesActualCents', null,
        'cogsCents', cogs_cents,
        'coveredGrossProfitCents', covered_revenue_cents - cogs_cents,
        'lossesCents', losses_cents,
        'unabsorbedOperatingExpensesCents', expenses_cents,
        'operatingResultBeforeProLaboreCents', covered_revenue_cents - cogs_cents - losses_cents - expenses_cents,
        'proLaboreCents', 0,
        'profitAfterProLaboreCents', covered_revenue_cents - cogs_cents - losses_cents - expenses_cents,
        'absorbedFixedCostsCents', null,
        'ownerWithdrawalsCents', null,
        'isPartial', is_partial or missing_loss_count > 0 or estimated_loss_count > 0
      ),
      'coverage', coverage_buckets || jsonb_build_object(
        'totalUnits', total_units,
        'totalRevenueCents', net_revenue_cents,
        'coveredUnits', covered_units,
        'coveredRevenueCents', covered_revenue_cents,
        'coveredUnitsPercent', coalesce(100.0 * covered_units / nullif(total_units, 0), 0),
        'coveredRevenuePercent', coalesce(100.0 * covered_revenue_cents / nullif(net_revenue_cents, 0), 0),
        'historicalUnitsPercent', coalesce(100.0 * historical_units / nullif(total_units, 0), 0),
        'historicalRevenuePercent', coalesce(100.0 * historical_revenue_cents / nullif(net_revenue_cents, 0), 0),
        'estimatedUnitsPercent', coalesce(100.0 * estimated_units / nullif(total_units, 0), 0),
        'estimatedRevenuePercent', coalesce(100.0 * estimated_revenue_cents / nullif(net_revenue_cents, 0), 0),
        'missingUnitsPercent', coalesce(100.0 * missing_units / nullif(total_units, 0), 0),
        'missingRevenuePercent', coalesce(100.0 * missing_revenue_cents / nullif(net_revenue_cents, 0), 0),
        'isPartial', is_partial
      ),
      'cost_classes', jsonb_build_object(
        'variable_material_packaging', null, 'variable_fee', fees_cents,
        'direct_labor', null, 'allocated_fixed', null, 'depreciation', null,
        'unabsorbed_operating_expense', expenses_cents, 'pro_labore', 0,
        'unclassifiedCogsCents', cogs_cents, 'allocationStatus', 'unallocated_manual_total'
      ),
      'cash', jsonb_build_object(
        'receivedCents', received_cents, 'expenseCents', expenses_cents,
        'withdrawalCents', withdrawals_cents, 'supplyCents', supplies_cents,
        'cashDifferenceCents', round((report #>> '{kpis,cash_difference}')::numeric * 100)
      ),
      'warnings', to_jsonb(array_remove(array[
        case when is_partial then 'partial_cost_coverage' end,
        case when has_estimates then 'estimated_current_costs' end,
        case when has_missing then 'missing_costs' end,
        case when estimated_loss_count > 0 then 'losses_estimated_current' end,
        case when missing_loss_count > 0 then 'missing_loss_costs' end,
        case when has_costs then 'cost_classes_unallocated' end,
        'pro_labore_not_classified', 'fees_allocated_proportionally',
        'fees_estimated_from_receipts', 'cash_excludes_unrecorded_site_receipts'
      ]::text[], null))
    ) as payload
    from totals t join loss_totals l using (period_key) join movement_totals m using (period_key)
  )
  select jsonb_object_agg(period_key, payload) into periods_report from period_results;

  current_report := periods_report->'current';
  previous_report := periods_report->'previous';
  if (current_report #>> '{result,salesRevenueCents}')::numeric <> round((legacy #>> '{kpis,revenue}')::numeric * 100)
    or (previous_report #>> '{result,salesRevenueCents}')::numeric <> round((previous_legacy #>> '{kpis,revenue}')::numeric * 100)
  then raise exception 'Receita do resultado não reconciliada com as vendas'; end if;

  return legacy || current_report || jsonb_build_object(
    'schema_version', 2, 'monetary_unit', 'BRL_cents',
    'receivables', jsonb_build_object(
      'basis', 'current_position',
      'totalCents', round((legacy #>> '{kpis,deferred_open}')::numeric * 100),
      'items', legacy->'receivables'
    ),
    'comparison', jsonb_build_object(
      'period', previous_legacy->'period',
      'result', previous_report->'result', 'coverage', previous_report->'coverage',
      'daily', previous_legacy->'daily'
    )
  );
end;
$function$;

revoke all on function public.manager_management_report_v2(date, date) from public, anon;
grant execute on function public.manager_management_report_v2(date, date) to authenticated;

commit;
