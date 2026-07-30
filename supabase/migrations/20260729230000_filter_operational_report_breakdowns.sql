begin;

alter function public.staff_get_operational_reports(date,date,uuid)
  rename to staff_get_operational_reports_breakdowns_internal;

revoke all on function public.staff_get_operational_reports_breakdowns_internal(date,date,uuid)
  from public, anon, authenticated, service_role;

create or replace function public.staff_get_operational_reports(
  range_start date,
  range_end date,
  target_store_id uuid default null,
  target_channel text default null,
  target_operator_user_id uuid default null,
  target_register_id uuid default null
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
  if target_channel is not null and target_channel not in ('online', 'presencial') then
    raise exception 'Filtro operacional inválido';
  end if;

  report := public.staff_get_operational_reports_breakdowns_internal(
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
  scoped_sessions as materialized (
    select
      session.*,
      store.name as store_name,
      store.finance_authorized
    from public.cash_sessions session
    join report_stores store on store.id = session.store_id
    where (
      coalesce(session.closed_at, session.opened_at) at time zone 'America/Fortaleza'
    )::date between range_start and range_end
  ),
  filtered_orders as materialized (
    select customer_order.*
    from scoped_orders customer_order
    where (target_channel is null or customer_order.sales_channel = target_channel)
      and (target_register_id is null or customer_order.cash_register_id = target_register_id)
      and (
        target_operator_user_id is null
        or exists (
          select 1
          from scoped_sale_movements movement
          where movement.order_id = customer_order.id
            and movement.created_by = target_operator_user_id
        )
      )
  ),
  filtered_sale_movements as materialized (
    select movement.*
    from scoped_sale_movements movement
    where (target_channel is null or target_channel = 'presencial')
      and (target_register_id is null or movement.register_id = target_register_id)
      and (target_operator_user_id is null or movement.created_by = target_operator_user_id)
  ),
  filtered_sessions as materialized (
    select session.*
    from scoped_sessions session
    where (target_channel is null or target_channel = 'presencial')
      and (target_register_id is null or session.register_id = target_register_id)
      and (
        target_operator_user_id is null
        or session.opened_by = target_operator_user_id
        or session.closed_by = target_operator_user_id
      )
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
    from filtered_orders customer_order
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
    left join filtered_orders customer_order
      on customer_order.cash_register_id = register.id
    group by
      store.id,
      store.name,
      register.id,
      register.name,
      store.finance_authorized
    having count(customer_order.id) > 0
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
    from filtered_sale_movements movement
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
    left join filtered_sessions session on session.register_id = register.id
    group by
      store.id,
      store.name,
      register.id,
      register.name,
      store.finance_authorized
    having count(session.id) > 0
  ),
  channel_options as (
    select distinct customer_order.sales_channel as value
    from scoped_orders customer_order
  ),
  register_options as (
    select
      register.id as value,
      register.name as label,
      store.id as store_id,
      store.name as store_name
    from public.cash_registers register
    join report_stores store on store.id = register.store_id
    where register.active
  ),
  operator_options as (
    select
      movement.created_by as value,
      coalesce(max(profile.full_name), 'Operador sem nome') as label,
      movement.store_id,
      movement.store_name
    from scoped_sale_movements movement
    left join public.profiles profile on profile.id = movement.created_by
    group by movement.created_by, movement.store_id, movement.store_name
  )
  select report || jsonb_build_object(
    'filter_scope', 'breakdowns_only',
    'active_filters', jsonb_build_object(
      'channel', target_channel,
      'operator_user_id', target_operator_user_id,
      'register_id', target_register_id
    ),
    'filter_options', jsonb_build_object(
      'channels', coalesce((
        select jsonb_agg(jsonb_build_object('value', option.value) order by option.value)
        from channel_options option
      ), '[]'::jsonb),
      'registers', coalesce((
        select jsonb_agg(to_jsonb(option) order by option.store_name, option.label)
        from register_options option
      ), '[]'::jsonb),
      'operators', coalesce((
        select jsonb_agg(to_jsonb(option) order by option.store_name, option.label)
        from operator_options option
      ), '[]'::jsonb)
    ),
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

revoke all on function public.staff_get_operational_reports(date,date,uuid,text,uuid,uuid)
  from public, anon;
grant execute on function public.staff_get_operational_reports(date,date,uuid,text,uuid,uuid)
  to authenticated;

do $$
declare
  wrapper_definition text;
begin
  select pg_get_functiondef(
    'public.staff_get_operational_reports(date,date,uuid,text,uuid,uuid)'::regprocedure
  ) into wrapper_definition;

  if wrapper_definition not ilike '%staff_get_operational_reports_breakdowns_internal%'
     or wrapper_definition not ilike '%target_channel%'
     or wrapper_definition not ilike '%target_operator_user_id%'
     or wrapper_definition not ilike '%target_register_id%'
     or wrapper_definition not ilike '%filter_scope%'
     or wrapper_definition not ilike '%breakdowns_only%'
     or wrapper_definition not ilike '%private.staff_has_capability(store.id, ''view_reports'')%'
     or wrapper_definition not ilike '%private.staff_has_capability(store.id, ''view_finance'')%' then
    raise exception 'Relatório operacional perdeu filtros, escopo ou redação obrigatórios';
  end if;

  if to_regprocedure('public.staff_get_operational_reports(date,date,uuid)') is not null
     or has_function_privilege(
       'anon',
       'public.staff_get_operational_reports(date,date,uuid,text,uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.staff_get_operational_reports(date,date,uuid,text,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.staff_get_operational_reports_breakdowns_internal(date,date,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.staff_get_operational_reports_breakdowns_internal(date,date,uuid)',
       'EXECUTE'
     ) then
    raise exception 'Grants inválidos na fronteira filtrada dos relatórios operacionais';
  end if;
end;
$$;

commit;
