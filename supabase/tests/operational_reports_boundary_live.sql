begin;

do $$
declare
  owner_actor uuid;
  test_staff uuid;
  owner_ids uuid[];
  primary_store uuid;
  secondary_store uuid;
  report jsonb;
  failure_message text;
  function_definition text;
begin
  select array_agg(user_id order by user_id::text)
  into owner_ids
  from public.staff_members
  where role::text = 'owner' and active;

  owner_actor := owner_ids[1];
  test_staff := owner_ids[2];
  if owner_actor is null or test_staff is null or owner_actor = test_staff then
    raise exception 'O teste vivo dos relatórios exige dois proprietários ativos em homologação';
  end if;

  select id into primary_store
  from public.stores
  where active
  order by created_at
  limit 1;

  if primary_store is null then
    raise exception 'O teste vivo dos relatórios exige uma loja ativa em homologação';
  end if;

  insert into public.stores(slug, name, public_label, active)
  values (
    'report-test-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    'Loja temporária do teste de relatórios',
    'Teste temporário',
    true
  ) returning id into secondary_store;

  insert into public.staff_store_assignments(
    staff_user_id,
    store_id,
    active,
    can_sell,
    can_open_cash,
    can_close_cash,
    can_manage_stock,
    can_view_finance,
    can_manage_customers,
    can_manage_orders,
    can_manage_production,
    can_view_reports,
    can_manage_settings,
    created_by,
    updated_by
  ) values (
    test_staff,
    primary_store,
    true,
    false,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
    true,
    false,
    owner_actor,
    owner_actor
  )
  on conflict (staff_user_id, store_id) do update
  set active = excluded.active,
      can_view_finance = excluded.can_view_finance,
      can_view_reports = excluded.can_view_reports;

  update public.staff_members
  set role = 'viewer'::public.staff_role, active = true
  where user_id = test_staff;
  perform set_config('request.jwt.claim.sub', test_staff::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  report := public.staff_get_operational_reports(current_date - 6, current_date, primary_store);

  if coalesce((report #>> '{capabilities,finance_authorized}')::boolean, true)
     or coalesce((report #>> '{capabilities,finance_scope_complete}')::boolean, true)
     or report #> '{summary,gross}' is distinct from 'null'::jsonb
     or report #> '{summary,net}' is distinct from 'null'::jsonb
     or report #> '{summary,cash_absolute_difference}' is distinct from 'null'::jsonb then
    raise exception 'Viewer recebeu valores financeiros no relatório';
  end if;

  if jsonb_typeof(report->'orders_by_channel') <> 'array'
     or jsonb_typeof(report->'sales_by_cash_register') <> 'array'
     or jsonb_typeof(report->'sales_by_operator') <> 'array'
     or jsonb_typeof(report->'cash_sessions_by_register') <> 'array'
     or jsonb_typeof(report #> '{filter_options,channels}') <> 'array'
     or jsonb_typeof(report #> '{filter_options,operators}') <> 'array'
     or jsonb_typeof(report #> '{filter_options,registers}') <> 'array' then
    raise exception 'Detalhamentos ou opções de filtro obrigatórios não foram retornados';
  end if;

  report := public.staff_get_operational_reports(
    current_date - 6,
    current_date,
    primary_store,
    'online',
    null,
    null
  );

  if report->>'filter_scope' is distinct from 'breakdowns_only'
     or report #>> '{active_filters,channel}' is distinct from 'online'
     or report #> '{active_filters,operator_user_id}' is distinct from 'null'::jsonb
     or report #> '{active_filters,register_id}' is distinct from 'null'::jsonb then
    raise exception 'Filtros rápidos não foram aplicados de forma fail-closed';
  end if;

  begin
    perform public.staff_get_operational_reports(current_date - 6, current_date, secondary_store);
    raise exception 'Viewer acessou relatório de loja sem atribuição';
  exception
    when others then
      failure_message := sqlerrm;
      if failure_message = 'Viewer acessou relatório de loja sem atribuição'
         or position('não possui acesso' in lower(failure_message)) = 0 then
        raise;
      end if;
  end;

  update public.staff_members
  set role = 'manager'::public.staff_role
  where user_id = test_staff;

  report := public.staff_get_operational_reports(current_date - 6, current_date, primary_store);
  if not coalesce((report #>> '{capabilities,finance_authorized}')::boolean, false)
     or not coalesce((report #>> '{capabilities,finance_scope_complete}')::boolean, false) then
    raise exception 'Manager não recebeu visão financeira na loja autorizada';
  end if;

  perform set_config('request.jwt.claim.sub', owner_actor::text, true);
  report := public.staff_get_operational_reports(current_date - 6, current_date, primary_store);
  if not coalesce((report #>> '{capabilities,finance_authorized}')::boolean, false)
     or not coalesce((report #>> '{capabilities,finance_scope_complete}')::boolean, false) then
    raise exception 'Owner não recebeu visão financeira na loja autorizada';
  end if;

  select pg_get_functiondef(
    'public.staff_get_operational_reports(date,date,uuid,text,uuid,uuid)'::regprocedure
  ) into function_definition;

  if position('staff_get_operational_reports_breakdowns_internal' in function_definition) = 0
     or position('target_channel' in function_definition) = 0
     or position('target_operator_user_id' in function_definition) = 0
     or position('target_register_id' in function_definition) = 0
     or position('filter_scope' in function_definition) = 0
     or position('orders_by_channel' in function_definition) = 0
     or position('sales_by_cash_register' in function_definition) = 0
     or position('sales_by_operator' in function_definition) = 0
     or position('cash_sessions_by_register' in function_definition) = 0 then
    raise exception 'A função efetiva perdeu filtros, wrapper ou detalhamentos obrigatórios';
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
    raise exception 'A fronteira de execução dos relatórios está exposta';
  end if;
end;
$$;

rollback;
