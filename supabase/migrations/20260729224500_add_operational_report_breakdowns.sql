begin;

alter function public.staff_get_operational_reports(date,date,uuid)
  rename to staff_get_operational_reports_base_internal;

revoke all on function public.staff_get_operational_reports_base_internal(date,date,uuid)
  from public, anon, authenticated, service_role;

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
  report := public.staff_get_operational_reports_base_internal(
    range_start,
    range_end,
    target_store_id
  );

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
    select coalesce(bool_and(store.finance_authorized), false) as finance_scope_complete
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
      ) as occurred_at,
      case
        when customer_order.cash_session_id is null then 'online'
        else 'presencial'
      end as sales_channel
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
  orders_by_channel as (
    select
      customer_order.sales_channel as channel,
      count(*)::integer as orders,
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(customer_order.gross_amount), 0)
        else null
      end as gross,
      case when (select finance_scope_complete from scope_flags)
        then coalesce(sum(customer_order.net_amount), 0)
        else null
      end as net
    from scoped_orders customer_order
    group by customer_order.sales_channel
  ),
  sales_by_cash_register as (
    select
      store.id as store_id,
      store.name as store_name,
      register.id as register_id,
      register.name as register_name,
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
    join public.cash_registers register
      on register.store_id = store.id
    left join scoped_orders customer_order
      on customer_order.cash_register_id = register.id
    group by
      store.id,
      store.name,
      register.id,
      register.name,
      store.finance_authorized
    having count(customer_order.id) > 0
  ),
  scoped_sale_movements as materialized (
    select
      movement.store_id,
      movement.register_id,
      movement.cash_session_id,
      movement.created_by,
      movement.order_id,
      movement.amount,
      movement.created_at,
      store.name as store_name,
      store.finance_authorized
    from public.cash_movements movement
    join report_stores store on store.id = movement.store_id
    where movement.kind = 'sale'
      and movement.direction = 'in'
      and (movement.created_at at time zone 'America/Fortaleza')::date
        between range_start and range_end
  ),
  sales_by_operator as (
    select
      movement.store_id,
      movement.store_name,
      movement.created_by as operator_user_id,
      coalesce(max(profile.full_name), 'Operador sem nome') as operator_name,
      movement.finance_authorized,
      count(distinct movement.order_id)::integer as orders,
      case when movement.finance_authorized
        then coalesce(sum(movement.amount), 0)
        else null
      end as gross
    from scoped_sale_movements movement
    left join public.profiles profile on profile.id = movement.created_by
    group by
      movement.store_id,
      movement.store_name,
      movement.created_by,
      movement.finance_authorized
  ),
  cash_sessions_by_register as (
    select
      store.id as store_id,
      store.name as store_name,
      register.id as register_id,
      register.name as register_name,
      store.finance_authorized,
      count(session.id)::integer as sessions,
      count(session.id) filter (where session.status = 'open')::integer as open_sessions,
      count(session.id) filter (where session.status = 'closed')::integer as closed_sessions,
      case when store.finance_authorized
        then count(session.id) filter (
          where session.status = 'closed' and session.cash_difference <> 0
        )::integer
        else null
      end as divergent_sessions,
      case when store.finance_authorized
        then coalesce(sum(abs(session.cash_difference)) filter (where session.status = 'closed'), 0)
        else null
      end as absolute_difference
    from report_stores store
    join public.cash_registers register on register.store_id = store.id
    left join public.cash_sessions session
      on session.register_id = register.id
     and (
       coalesce(session.closed_at, session.opened_at) at time zone 'America/Fortaleza'
     )::date between range_start and range_end
    group by
      store.id,
      store.name,
      register.id,
      register.name,
      store.finance_authorized
    having count(session.id) > 0
  )
  select report || jsonb_build_object(
    'orders_by_channel', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.orders desc, row_value.channel)
      from orders_by_channel row_value
    ), '[]'::jsonb),
    'sales_by_cash_register', coalesce((
      select jsonb_agg(
        to_jsonb(row_value)
        order by row_value.orders desc, row_value.store_name, row_value.register_name
      )
      from sales_by_cash_register row_value
    ), '[]'::jsonb),
    'sales_by_operator', coalesce((
      select jsonb_agg(
        to_jsonb(row_value)
        order by row_value.orders desc, row_value.store_name, row_value.operator_name
      )
      from sales_by_operator row_value
    ), '[]'::jsonb),
    'cash_sessions_by_register', coalesce((
      select jsonb_agg(
        to_jsonb(row_value)
        order by row_value.sessions desc, row_value.store_name, row_value.register_name
      )
      from cash_sessions_by_register row_value
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
  wrapper_definition text;
begin
  select pg_get_functiondef(
    'public.staff_get_operational_reports(date,date,uuid)'::regprocedure
  ) into wrapper_definition;

  if wrapper_definition not ilike '%staff_get_operational_reports_base_internal%'
     or wrapper_definition not ilike '%orders_by_channel%'
     or wrapper_definition not ilike '%sales_by_cash_register%'
     or wrapper_definition not ilike '%sales_by_operator%'
     or wrapper_definition not ilike '%cash_sessions_by_register%'
     or wrapper_definition not ilike '%staff_has_capability(store.id, ''view_reports'')%'
     or wrapper_definition not ilike '%staff_has_capability(store.id, ''view_finance'')%' then
    raise exception 'Relatório operacional perdeu escopo, redação ou detalhamentos obrigatórios';
  end if;

  if has_function_privilege(
       'anon',
       'public.staff_get_operational_reports(date,date,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.staff_get_operational_reports(date,date,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.staff_get_operational_reports_base_internal(date,date,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.staff_get_operational_reports_base_internal(date,date,uuid)',
       'EXECUTE'
     ) then
    raise exception 'Grants inválidos na fronteira dos relatórios operacionais';
  end if;
end;
$$;

commit;
