begin;

create or replace function public.staff_get_operational_reports(
  range_start date,
  range_end date,
  target_store_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  report jsonb;
begin
  if (select auth.uid()) is null or not private.staff_has_any_capability('view_reports') then
    raise exception 'Acesso aos relatorios nao autorizado';
  end if;
  if range_start is null or range_end is null or range_end < range_start or range_end - range_start > 370 then
    raise exception 'Escolha um periodo valido de ate 370 dias';
  end if;
  if target_store_id is not null and not private.can_view_reports_at_store(target_store_id) then
    raise exception 'Voce nao possui acesso aos relatorios desta loja';
  end if;

  with scoped_orders as (
    select
      customer_order.*,
      coalesce(customer_order.payment_recorded_at, customer_order.paid_at, customer_order.created_at) as occurred_at
    from public.instant_orders customer_order
    where customer_order.payment_status::text = 'approved'
      and (coalesce(customer_order.payment_recorded_at, customer_order.paid_at, customer_order.created_at) at time zone 'America/Fortaleza')::date between range_start and range_end
      and (target_store_id is null or customer_order.store_id = target_store_id)
      and (
        (customer_order.store_id is null and private.is_manager())
        or (customer_order.store_id is not null and private.can_view_reports_at_store(customer_order.store_id))
      )
  ),
  sales_by_day as (
    select
      (occurred_at at time zone 'America/Fortaleza')::date as sale_date,
      count(*)::integer as orders,
      coalesce(sum(gross_amount), 0) as gross,
      coalesce(sum(payment_fee_amount), 0) as fees,
      coalesce(sum(net_amount), 0) as net
    from scoped_orders
    group by 1
  ),
  payment_methods as (
    select
      coalesce(payment_method_code, 'not_informed') as code,
      coalesce(max(payment_method_label), 'Nao informado') as label,
      count(*)::integer as orders,
      coalesce(sum(gross_amount), 0) as gross,
      coalesce(sum(net_amount), 0) as net
    from scoped_orders
    group by coalesce(payment_method_code, 'not_informed')
  ),
  sales_by_store as (
    select
      customer_order.store_id,
      coalesce(max(store_row.name), 'Sem loja vinculada') as store_name,
      count(*)::integer as orders,
      coalesce(sum(customer_order.gross_amount), 0) as gross,
      coalesce(sum(customer_order.net_amount), 0) as net
    from scoped_orders customer_order
    left join public.stores store_row on store_row.id = customer_order.store_id
    group by customer_order.store_id
  ),
  top_products as (
    select
      item.flavor_id,
      max(item.flavor_name) as product_name,
      sum(item.quantity)::integer as quantity,
      coalesce(sum(item.quantity * item.unit_price), 0) as gross
    from public.instant_order_items item
    join scoped_orders customer_order on customer_order.id = item.order_id
    group by item.flavor_id
    order by quantity desc, gross desc
    limit 12
  ),
  scoped_cash_sessions as (
    select session.*
    from public.cash_sessions session
    where session.status = 'closed'
      and (session.closed_at at time zone 'America/Fortaleza')::date between range_start and range_end
      and (target_store_id is null or session.store_id = target_store_id)
      and private.can_view_reports_at_store(session.store_id)
  ),
  cash_summary as (
    select
      count(*)::integer as sessions,
      coalesce(sum(abs(cash_difference)), 0) as absolute_difference,
      coalesce(sum(cash_difference), 0) as net_difference,
      count(*) filter (where cash_difference <> 0)::integer as divergent_sessions
    from scoped_cash_sessions
  ),
  scoped_checkins as (
    select checkin.*
    from public.customer_checkins checkin
    where (checkin.created_at at time zone 'America/Fortaleza')::date between range_start and range_end
      and (target_store_id is null or checkin.store_id = target_store_id)
      and private.can_view_reports_at_store(checkin.store_id)
  ),
  checkin_summary as (
    select
      count(*)::integer as total,
      count(*) filter (where status = 'claimed')::integer as claimed,
      count(*) filter (where status = 'expired')::integer as expired
    from scoped_checkins
  ),
  loyalty_summary as (
    select
      coalesce(sum(greatest(ledger.stamps_delta, 0)), 0)::integer as stamps_added,
      coalesce(sum(abs(least(ledger.stamps_delta, 0))), 0)::integer as stamps_removed,
      count(*) filter (where ledger.reason::text = 'reward_redeemed')::integer as rewards_redeemed,
      count(*) filter (where ledger.reason::text = 'manual_adjustment')::integer as manual_adjustments
    from public.ledger_entries ledger
    where private.is_manager()
      and (ledger.created_at at time zone 'America/Fortaleza')::date between range_start and range_end
  ),
  loyalty_reasons as (
    select
      ledger.reason::text as reason,
      count(*)::integer as movements,
      coalesce(sum(ledger.stamps_delta), 0)::integer as net_stamps
    from public.ledger_entries ledger
    where private.is_manager()
      and (ledger.created_at at time zone 'America/Fortaleza')::date between range_start and range_end
    group by ledger.reason
    order by movements desc
  ),
  new_customers as (
    select count(*)::integer as total
    from public.profiles profile
    where private.is_manager()
      and (profile.created_at at time zone 'America/Fortaleza')::date between range_start and range_end
      and not exists(select 1 from public.staff_members staff where staff.user_id = profile.id)
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', range_start, 'to', range_end, 'store_id', target_store_id),
    'summary', jsonb_build_object(
      'orders', coalesce((select count(*)::integer from scoped_orders), 0),
      'gross', coalesce((select sum(gross_amount) from scoped_orders), 0),
      'fees', coalesce((select sum(payment_fee_amount) from scoped_orders), 0),
      'net', coalesce((select sum(net_amount) from scoped_orders), 0),
      'average_ticket', coalesce((select avg(gross_amount) from scoped_orders), 0),
      'new_customers', coalesce((select total from new_customers), 0),
      'stamps_added', coalesce((select stamps_added from loyalty_summary), 0),
      'stamps_removed', coalesce((select stamps_removed from loyalty_summary), 0),
      'rewards_redeemed', coalesce((select rewards_redeemed from loyalty_summary), 0),
      'manual_adjustments', coalesce((select manual_adjustments from loyalty_summary), 0),
      'checkins', coalesce((select total from checkin_summary), 0),
      'claimed_checkins', coalesce((select claimed from checkin_summary), 0),
      'expired_checkins', coalesce((select expired from checkin_summary), 0),
      'cash_sessions', coalesce((select sessions from cash_summary), 0),
      'cash_divergent_sessions', coalesce((select divergent_sessions from cash_summary), 0),
      'cash_absolute_difference', coalesce((select absolute_difference from cash_summary), 0),
      'cash_net_difference', coalesce((select net_difference from cash_summary), 0)
    ),
    'sales_by_day', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.sale_date) from sales_by_day row_value), '[]'::jsonb),
    'payment_methods', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.gross desc) from payment_methods row_value), '[]'::jsonb),
    'stores', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.gross desc) from sales_by_store row_value), '[]'::jsonb),
    'top_products', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.quantity desc) from top_products row_value), '[]'::jsonb),
    'loyalty_reasons', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.movements desc) from loyalty_reasons row_value), '[]'::jsonb)
  ) into report;

  return report;
end;
$$;

revoke all on function public.staff_get_operational_reports(date,date,uuid) from public, anon;
grant execute on function public.staff_get_operational_reports(date,date,uuid) to authenticated;

commit;
