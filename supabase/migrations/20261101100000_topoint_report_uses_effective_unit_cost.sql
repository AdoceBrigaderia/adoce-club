begin;

-- Mesmo problema, terceiro lugar: private.topoint_management_report (usada
-- pela exportação pro TOPOINT Finanças) é uma cópia de
-- manager_management_report e também lia custo direto de flavor_costs.
create or replace function private.topoint_management_report(start_date date, end_date date)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare r jsonb; days integer; prev_start date; prev_end date;
begin

  if start_date is null or end_date is null or end_date < start_date then raise exception 'Período inválido'; end if;
  if end_date - start_date > 400 then raise exception 'Escolha um período de até 400 dias'; end if;
  days := end_date - start_date + 1;
  prev_end := start_date - 1;
  prev_start := start_date - days;

  with orders as (
    select o.*, (coalesce(o.completed_at, o.created_at) at time zone 'America/Fortaleza') as local_at
    from public.instant_orders o
    where (coalesce(o.completed_at, o.created_at) at time zone 'America/Fortaleza')::date between prev_start and end_date
  ), cur as (
    select * from orders where local_at::date between start_date and end_date
  ), done as (
    select * from cur where status = 'completed'
  ), prev_done as (
    select * from orders where status = 'completed' and local_at::date between prev_start and prev_end
  ), items as (
    select i.flavor_name,i.quantity,i.is_reward,i.unit_price,f.base_price as table_price,c.unit_cost,d.local_at
from public.instant_order_items i join done d on d.id=i.order_id
left join public.flavors f on f.id=i.flavor_id
left join lateral (select public.flavor_effective_unit_cost(i.flavor_id) as unit_cost) c on true
union all select a.flavor_name,a.quantity_delta,false,a.unit_price,a.unit_price,c.unit_cost,a.service_date::timestamp
from private.cash_sale_conference_corrections a
left join lateral (select public.flavor_effective_unit_cost(a.flavor_id) as unit_cost) c on true
where a.service_date between start_date and end_date
  ), moves as (
    select m.* from public.cash_movements m
    where (m.created_at at time zone 'America/Fortaleza')::date between start_date and end_date
  ), pay_cash as (
    select payment_method_code as method, sum(case when direction = 'in' then amount else -amount end) as amount, count(*) filter (where direction = 'in') as entries
    from moves where kind in ('sale', 'refund') group by payment_method_code
  ), pay_site as (
    select coalesce(payment_method_code, 'pix') as method, sum(total) as amount, count(*) as entries
    from done where cash_session_id is null group by coalesce(payment_method_code, 'pix')
  ), pay as (
    select method, sum(amount) as amount, sum(entries) as entries from (select * from pay_cash union all select * from pay_site) u group by method
  ), losses as (
    select l.*, c.unit_cost
    from public.slice_losses l
    left join lateral (select public.flavor_effective_unit_cost(l.flavor_id) as unit_cost) c on true
    where l.service_date between start_date and end_date
  )
  select jsonb_build_object(
    'period', jsonb_build_object('start', start_date, 'end', end_date, 'days', days, 'previous_start', prev_start, 'previous_end', prev_end),
    'kpis', jsonb_build_object(
      'revenue', (select coalesce(sum(total), 0) from done),
      'previous_revenue', (select coalesce(sum(total), 0) from prev_done),
      'sales_count', (select count(*) from done),
      'previous_sales_count', (select count(*) from prev_done),
      'slices_sold', (select coalesce(sum(quantity), 0) from items),
      'rewards_count', (select coalesce(sum(quantity), 0) from items where is_reward),
      'losses', (select coalesce(sum(quantity), 0) from losses),
      'fees', (select coalesce(sum(round(p.amount * coalesce(pm.fee_percent, 0) / 100 + p.entries * coalesce(pm.fee_fixed, 0), 2)), 0) from pay p left join public.payment_methods pm on pm.code = p.method),
      'cash_difference', (select coalesce(sum(cash_difference), 0) from public.cash_sessions where status = 'closed' and (closed_at at time zone 'America/Fortaleza')::date between start_date and end_date),
      'deferred_open', (select coalesce(sum(total - coalesce(amount_paid, 0)), 0) from public.instant_orders where payment_deferred and payment_status <> 'approved' and status <> 'cancelled')
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date', d::date, 'revenue', coalesce(x.revenue, 0), 'count', coalesce(x.count, 0)) order by d)
      from generate_series(start_date, end_date, interval '1 day') d
      left join (select local_at::date as day, sum(total) revenue, count(*) count from done group by 1) x on x.day = d::date), '[]'),
    'hourly', coalesce((select jsonb_agg(jsonb_build_object('hour', h, 'count', coalesce(x.count, 0)) order by h)
      from generate_series(0, 23) h
      left join (select extract(hour from local_at)::int as hour, count(*) count from done group by 1) x on x.hour = h), '[]'),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('method', p.method, 'label', coalesce(pm.label, p.method), 'amount', p.amount,
        'fee', round(p.amount * coalesce(pm.fee_percent, 0) / 100 + p.entries * coalesce(pm.fee_fixed, 0), 2)) order by p.amount desc)
      from pay p left join public.payment_methods pm on pm.code = p.method), '[]'),
    'flavors', coalesce((select jsonb_agg(x order by x.sold desc, x.name) from (
        select coalesce(i.flavor_name, 'Sem sabor') as name, sum(i.quantity)::int as sold, sum(i.quantity) filter (where i.is_reward)::int as rewards,
               sum(case when i.is_reward then 0 else i.unit_price * i.quantity end) as revenue,
               max(i.unit_cost) as unit_cost,
               sum(i.quantity * i.unit_cost) as cost
        from items i group by coalesce(i.flavor_name, 'Sem sabor')) x), '[]'),
    'channels', coalesce((select jsonb_agg(jsonb_build_object('channel', coalesce(sales_channel, 'operation'), 'count', c, 'revenue', v) order by v desc)
      from (select sales_channel, count(*) c, sum(total) v from done group by sales_channel) x), '[]'),
    'sessions', coalesce((select jsonb_agg(private.cash_session_summary(s.id) order by s.opened_at desc)
      from public.cash_sessions s where (s.opened_at at time zone 'America/Fortaleza')::date between start_date and end_date), '[]'),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object('date', m.created_at, 'kind', m.kind, 'method', m.payment_method_code, 'amount', m.amount, 'notes', m.notes) order by m.created_at desc)
      from moves m where m.kind in ('expense', 'withdrawal', 'supply')), '[]'),
    'receivables', coalesce((select jsonb_agg(jsonb_build_object('order_number', o.order_number, 'customer_name', o.customer_name, 'remaining', o.total - coalesce(o.amount_paid, 0), 'created_at', o.created_at,
        'days', ((now() at time zone 'America/Fortaleza')::date - (o.created_at at time zone 'America/Fortaleza')::date)) order by o.created_at)
      from public.instant_orders o where o.payment_deferred and o.payment_status <> 'approved' and o.status <> 'cancelled'), '[]'),
    'losses', coalesce((select jsonb_agg(jsonb_build_object('name', f.name, 'quantity', x.quantity, 'cost', x.cost) order by x.quantity desc)
      from (select flavor_id, sum(quantity)::int quantity, sum(quantity * unit_cost) cost from losses group by flavor_id) x join public.flavors f on f.id = x.flavor_id), '[]'),
    'adjustments', jsonb_build_object(
      'discounts', (select coalesce(sum(discount_amount), 0) from done),
      'rewards_value', (select coalesce(sum(coalesce(table_price, unit_price) * quantity), 0) from items where is_reward),
      'cancelled_count', (select count(*) from cur where status = 'cancelled'),
      'cancelled_value', (select coalesce(sum(total), 0) from cur where status = 'cancelled')
    ),
    'dre', jsonb_build_object(
      'table_value', (select coalesce(sum(coalesce(table_price, unit_price) * quantity), 0) from items),
      'discounts', (select coalesce(sum(discount_amount), 0) from done),
      'rewards_value', (select coalesce(sum(coalesce(table_price, unit_price) * quantity), 0) from items where is_reward),
      'revenue', (select coalesce(sum(total), 0) from done),
      'fees', (select coalesce(sum(round(p.amount * coalesce(pm.fee_percent, 0) / 100 + p.entries * coalesce(pm.fee_fixed, 0), 2)), 0) from pay p left join public.payment_methods pm on pm.code = p.method),
      'cogs', (select coalesce(sum(quantity * unit_cost), 0) from items where unit_cost is not null),
      'cogs_coverage', (select case when coalesce(sum(quantity), 0) = 0 then 0 else round(100.0 * coalesce(sum(quantity) filter (where unit_cost is not null), 0) / sum(quantity), 1) end from items),
      'losses_cost', (select coalesce(sum(quantity * unit_cost), 0) from losses where unit_cost is not null),
      'expenses', (select coalesce(sum(amount), 0) from moves where kind = 'expense')
    )
  ) into r;
  r:=jsonb_set(r,'{kpis,revenue}',to_jsonb((r#>>'{kpis,revenue}')::numeric+(select coalesce(sum(quantity_delta*unit_price),0) from private.cash_sale_conference_corrections where service_date between start_date and end_date)));
 r:=jsonb_set(r,'{kpis,previous_revenue}',to_jsonb((r#>>'{kpis,previous_revenue}')::numeric+(select coalesce(sum(quantity_delta*unit_price),0) from private.cash_sale_conference_corrections where service_date between prev_start and prev_end)));
 r:=jsonb_set(r,'{dre,revenue}',r#>'{kpis,revenue}');
 r:=jsonb_set(r,'{daily}',(select coalesce(jsonb_agg(d || jsonb_build_object('revenue',(d->>'revenue')::numeric+(select coalesce(sum(quantity_delta*unit_price),0) from private.cash_sale_conference_corrections where service_date=(d->>'date')::date))),'[]'::jsonb) from jsonb_array_elements(r->'daily') d));
 r:=r || jsonb_build_object('conference_corrections',coalesce((select jsonb_agg(to_jsonb(c)) from private.cash_sale_conference_corrections c where service_date between start_date and end_date),'[]'::jsonb));
  return r;
end; $function$;

commit;
