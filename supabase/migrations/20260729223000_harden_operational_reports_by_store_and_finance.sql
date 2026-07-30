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
  global_metrics_authorized boolean;
begin
  if (select auth.uid()) is null
     or not private.staff_has_any_capability('view_reports') then
    raise exception 'Acesso aos relatorios nao autorizado';
  end if;

  if range_start is null
     or range_end is null
     or range_end < range_start
     or range_end - range_start > 370 then
    raise exception 'Escolha um periodo valido de ate 370 dias';
  end if;

  if target_store_id is not null
     and not private.staff_has_capability(target_store_id, 'view_reports') then
    raise exception 'Voce nao possui acesso aos relatorios desta loja';
  end if;

  global_metrics_authorized := private.is_manager() and target_store_id is null;

  with report_stores as materialized (
    select
      store.id,
      store.name,
      private.staff_has_capability(store.id, 'view_finance') as finance_authorized
    from public.stores store
    where store.active
      and private.staff_has_capability(store.id, 'view_reports')
      and (target_store_id is null or store.id = target_store_id)
  ),
  scope_flags as (
    select
      count(*)::integer as store_count,
      coalesce(bool_and(store.finance_authorized), false) as finance_scope_complete,
      coalesce(bool_or(store.finance_authorized), false) as finance_authorized
    from report_stores store
  ),
  scoped_orders as materialized (
    select
      customer_order.*,
      store.name as store_name,
      store.finance_authorized,
      coalesce(
        customer_order.payment_recorded_at,
        customer_order.paid_at,
        customer_order.created_at
      ) as occurred_at
    from public.instant_orders customer_order
    join report_stores store on store.id = customer_order.store_id
    where customer_order.payment_status::text = 'approved'
      and (
        coalesce(
          customer_order.payment_recorded_at,
          customer_order.paid_at,
          customer_order.created_at
        ) at time zone 'America/Fortaleza'
      )::date between range_start and range_end
  ),
  sales_by_day as (
    select
      (customer_order.occurred_at at time zone 'America/Fortaleza')::date as sale_date,
      count(*)::integer as orders,
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(customer_order.gross_amount), 0)
        else null
      end as gross,
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(customer_order.payment_fee_amount), 0)
        else null
      end as fees,
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(customer_order.net_amount), 0)
        else null
      end as net
    from scoped_orders customer_order
    group by 1
  ),
  payment_methods as (
    select
      coalesce(customer_order.payment_method_code, 'not_informed') as code,
      coalesce(max(customer_order.payment_method_label), 'Nao informado') as label,
      count(*)::integer as orders,
      coalesce(sum(customer_order.gross_amount), 0) as gross,
      coalesce(sum(customer_order.net_amount), 0) as net
    from scoped_orders customer_order
    where (select finance_scope_complete from scope_flags)
    group by coalesce(customer_order.payment_method_code, 'not_informed')
  ),
  sales_by_store as (
    select
      store.id as store_id,
      store.name as store_name,
      store.finance_authorized,
      count(customer_order.id)::integer as orders,
      case when store.finance_authorized
        then coalesce(sum(customer_order.gross_amount), 0)
        else null
      end as gross,
      case when store.finance_authorized
        then coalesce(sum(customer_order.net_amount), 0)
        else null
      end as net
    from report_stores store
    left join scoped_orders customer_order on customer_order.store_id = store.id
    group by store.id, store.name, store.finance_authorized
  ),
  top_products as (
    select
      item.flavor_id,
      max(item.flavor_name) as product_name,
      sum(item.quantity)::integer as quantity,
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(item.quantity * item.unit_price), 0)
        else null
      end as gross
    from public.instant_order_items item
    join scoped_orders customer_order on customer_order.id = item.order_id
    group by item.flavor_id
    order by quantity desc, product_name
    limit 12
  ),
  scoped_cash_sessions as materialized (
    select session.*
    from public.cash_sessions session
    join report_stores store on store.id = session.store_id
    where session.status = 'closed'
      and (session.closed_at at time zone 'America/Fortaleza')::date
        between range_start and range_end
  ),
  cash_summary as (
    select
      count(*)::integer as sessions,
      case when (select finance_scope_complete from scope_flags)
        then count(*) filter (where session.cash_difference <> 0)::integer
        else null
      end as divergent_sessions,
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(abs(session.cash_difference)), 0)
        else null
      end as absolute_difference,
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(session.cash_difference), 0)
        else null
      end as net_difference
    from scoped_cash_sessions session
  ),
  scoped_cash_movements as materialized (
    select movement.*
    from public.cash_movements movement
    join report_stores store on store.id = movement.store_id
    where (movement.created_at at time zone 'America/Fortaleza')::date
      between range_start and range_end
  ),
  cash_movement_summary as (
    select
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(movement.amount) filter (where movement.kind = 'expense'), 0)
        else null
      end as expenses,
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(movement.amount) filter (where movement.kind = 'refund'), 0)
        else null
      end as refunds,
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(movement.amount) filter (where movement.kind = 'supply'), 0)
        else null
      end as supplies,
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(movement.amount) filter (where movement.kind = 'withdrawal'), 0)
        else null
      end as withdrawals
    from scoped_cash_movements movement
  ),
  scoped_checkins as materialized (
    select checkin.*
    from public.customer_checkins checkin
    join report_stores store on store.id = checkin.store_id
    where (checkin.created_at at time zone 'America/Fortaleza')::date
      between range_start and range_end
  ),
  checkin_summary as (
    select
      count(*)::integer as total,
      count(*) filter (where checkin.status = 'claimed')::integer as claimed,
      count(*) filter (where checkin.status = 'expired')::integer as expired
    from scoped_checkins checkin
  ),
  scoped_service_requests as materialized (
    select request.*
    from public.service_requests request
    join report_stores store on store.id = request.store_id
    where (request.created_at at time zone 'America/Fortaleza')::date
      between range_start and range_end
  ),
  service_request_summary as (
    select
      count(*)::integer as total,
      count(*) filter (
        where request.status::text in ('prebooked', 'quoted', 'awaiting_deposit', 'confirmed', 'in_production', 'ready')
      )::integer as active,
      count(*) filter (where request.status::text = 'ready')::integer as ready,
      count(*) filter (where request.status::text = 'completed')::integer as completed,
      count(*) filter (where request.status::text = 'cancelled')::integer as cancelled,
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(request.paid_amount) filter (where request.payment_status = 'paid'), 0)
        else null
      end as paid_amount,
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(request.paid_amount) filter (where request.payment_status = 'refund_pending'), 0)
        else null
      end as refund_pending_amount
    from scoped_service_requests request
  ),
  service_requests_by_status as (
    select
      request.status::text as status,
      count(*)::integer as requests
    from scoped_service_requests request
    group by request.status::text
  ),
  loyalty_summary as (
    select
      coalesce(sum(greatest(ledger.stamps_delta, 0)), 0)::integer as stamps_added,
      coalesce(sum(abs(least(ledger.stamps_delta, 0))), 0)::integer as stamps_removed,
      count(*) filter (where ledger.reason::text = 'reward_redeemed')::integer as rewards_redeemed,
      count(*) filter (where ledger.reason::text = 'manual_adjustment')::integer as manual_adjustments
    from public.ledger_entries ledger
    where global_metrics_authorized
      and (ledger.created_at at time zone 'America/Fortaleza')::date
        between range_start and range_end
  ),
  loyalty_reasons as (
    select
      ledger.reason::text as reason,
      count(*)::integer as movements,
      coalesce(sum(ledger.stamps_delta), 0)::integer as net_stamps
    from public.ledger_entries ledger
    where global_metrics_authorized
      and (ledger.created_at at time zone 'America/Fortaleza')::date
        between range_start and range_end
    group by ledger.reason
    order by movements desc
  ),
  new_customers as (
    select count(*)::integer as total
    from public.profiles profile
    where global_metrics_authorized
      and (profile.created_at at time zone 'America/Fortaleza')::date
        between range_start and range_end
      and not exists (
        select 1
        from public.staff_members staff
        where staff.user_id = profile.id
      )
  ),
  unassigned_orders as (
    select count(*)::integer as total
    from public.instant_orders customer_order
    where global_metrics_authorized
      and customer_order.store_id is null
      and customer_order.payment_status::text = 'approved'
      and (
        coalesce(
          customer_order.payment_recorded_at,
          customer_order.paid_at,
          customer_order.created_at
        ) at time zone 'America/Fortaleza'
      )::date between range_start and range_end
  )
  select jsonb_build_object(
    'period', jsonb_build_object(
      'from', range_start,
      'to', range_end,
      'store_id', target_store_id
    ),
    'capabilities', jsonb_build_object(
      'finance_authorized', (select finance_authorized from scope_flags),
      'finance_scope_complete', (select finance_scope_complete from scope_flags),
      'global_metrics_authorized', global_metrics_authorized
    ),
    'summary', jsonb_build_object(
      'orders', coalesce((select count(*)::integer from scoped_orders), 0),
      'approved_orders', coalesce((select count(*)::integer from scoped_orders), 0),
      'unassigned_orders', case when global_metrics_authorized
        then coalesce((select total from unassigned_orders), 0)
        else null
      end,
      'gross', case when (select finance_scope_complete from scope_flags)
        then coalesce((select sum(gross_amount) from scoped_orders), 0)
        else null
      end,
      'fees', case when (select finance_scope_complete from scope_flags)
        then coalesce((select sum(payment_fee_amount) from scoped_orders), 0)
        else null
      end,
      'net', case when (select finance_scope_complete from scope_flags)
        then coalesce((select sum(net_amount) from scoped_orders), 0)
        else null
      end,
      'average_ticket', case when (select finance_scope_complete from scope_flags)
        then coalesce((select avg(gross_amount) from scoped_orders), 0)
        else null
      end,
      'new_customers', case when global_metrics_authorized
        then coalesce((select total from new_customers), 0)
        else null
      end,
      'stamps_added', case when global_metrics_authorized
        then coalesce((select stamps_added from loyalty_summary), 0)
        else null
      end,
      'stamps_removed', case when global_metrics_authorized
        then coalesce((select stamps_removed from loyalty_summary), 0)
        else null
      end,
      'rewards_redeemed', case when global_metrics_authorized
        then coalesce((select rewards_redeemed from loyalty_summary), 0)
        else null
      end,
      'manual_adjustments', case when global_metrics_authorized
        then coalesce((select manual_adjustments from loyalty_summary), 0)
        else null
      end,
      'checkins', coalesce((select total from checkin_summary), 0),
      'claimed_checkins', coalesce((select claimed from checkin_summary), 0),
      'expired_checkins', coalesce((select expired from checkin_summary), 0),
      'cash_sessions', coalesce((select sessions from cash_summary), 0),
      'cash_divergent_sessions', (select divergent_sessions from cash_summary),
      'cash_absolute_difference', (select absolute_difference from cash_summary),
      'cash_net_difference', (select net_difference from cash_summary),
      'cash_expenses', (select expenses from cash_movement_summary),
      'cash_refunds', (select refunds from cash_movement_summary),
      'cash_supplies', (select supplies from cash_movement_summary),
      'cash_withdrawals', (select withdrawals from cash_movement_summary),
      'service_requests', coalesce((select total from service_request_summary), 0),
      'service_requests_active', coalesce((select active from service_request_summary), 0),
      'service_requests_ready', coalesce((select ready from service_request_summary), 0),
      'service_requests_completed', coalesce((select completed from service_request_summary), 0),
      'service_requests_cancelled', coalesce((select cancelled from service_request_summary), 0),
      'service_requests_paid_amount', (select paid_amount from service_request_summary),
      'service_requests_refund_pending_amount', (select refund_pending_amount from service_request_summary)
    ),
    'sales_by_day', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.sale_date)
      from sales_by_day row_value
    ), '[]'::jsonb),
    'payment_methods', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.gross desc)
      from payment_methods row_value
    ), '[]'::jsonb),
    'stores', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.orders desc, row_value.store_name)
      from sales_by_store row_value
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.quantity desc)
      from top_products row_value
    ), '[]'::jsonb),
    'loyalty_reasons', case when global_metrics_authorized then coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.movements desc)
      from loyalty_reasons row_value
    ), '[]'::jsonb) else '[]'::jsonb end,
    'service_requests_by_status', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.requests desc, row_value.status)
      from service_requests_by_status row_value
    ), '[]'::jsonb)
  ) into report;

  return report;
end;
$$;

revoke all on function public.staff_get_operational_reports(date,date,uuid)
  from public, anon;
grant execute on function public.staff_get_operational_reports(date,date,uuid)
  to authenticated;

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.staff_get_operational_reports(date,date,uuid)'::regprocedure
  ) into function_definition;

  if function_definition not ilike '%staff_has_capability(store.id, ''view_reports'')%'
     or function_definition not ilike '%staff_has_capability(store.id, ''view_finance'')%'
     or function_definition not ilike '%finance_scope_complete%'
     or function_definition not ilike '%service_requests_by_status%'
     or function_definition not ilike '%cash_expenses%' then
    raise exception 'Relatorio operacional sem isolamento ou redacao financeira obrigatoria';
  end if;

  if has_function_privilege('anon', 'public.staff_get_operational_reports(date,date,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.staff_get_operational_reports(date,date,uuid)', 'EXECUTE')
     or exists (
       select 1
       from pg_proc procedure
       cross join lateral aclexplode(
         coalesce(procedure.proacl, acldefault('f', procedure.proowner))
       ) privilege
       where procedure.oid = 'public.staff_get_operational_reports(date,date,uuid)'::regprocedure
         and privilege.grantee = 0
         and privilege.privilege_type = 'EXECUTE'
     ) then
    raise exception 'Grants invalidos no relatorio operacional';
  end if;
end;
$$;

commit;
