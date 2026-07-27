begin;

do $$
declare
  allowed text[] := array[
    'customer_complete_registration',
    'customer_create_store_checkin',
    'customer_get_account_workspace',
    'customer_prepare_google_wallet_pass',
    'get_checkout_payment_methods',
    'issue_customer_qr',
    'manager_cancel_empty_cash_session',
    'manager_create_manual_sale_for_reconciliation',
    'manager_get_whatsapp_otp_metrics',
    'manager_reconcile_cash_sale',
    'manager_set_staff_capability',
    'manager_set_staff_store_assignment',
    'manager_update_staff_member',
    'manager_upsert_cash_register',
    'manager_upsert_store',
    'member_instant_order_loyalty_preview',
    'public_quote_instant_order',
    'staff_add_customer_crm_note',
    'staff_adjust_loyalty_stamps',
    'staff_apply_customer_checkin_stamps',
    'staff_close_cash_session',
    'staff_create_manual_sale_in_cash',
    'staff_financial_sales_summary',
    'staff_get_business_workspace',
    'staff_get_cash_reconciliation_queue',
    'staff_get_commerce_settings',
    'staff_get_customer_360',
    'staff_get_operational_reports',
    'staff_get_quick_sale_catalog',
    'staff_list_active_customer_checkins',
    'staff_lookup_customer_by_qr',
    'staff_open_cash_session',
    'staff_record_cash_movement',
    'staff_search_customers',
    'staff_set_customer_crm_tag',
    'staff_set_quick_sale_favorite',
    'staff_update_commerce_settings',
    'submit_instant_order_v5'
  ];
  unexpected text[];
  missing text[];
  anon_count integer;
begin
  select array_agg(distinct p.proname order by p.proname)
  into unexpected
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'execute')
    and not (p.proname = any(allowed));

  if coalesce(cardinality(unexpected), 0) > 0 then
    raise exception 'Unexpected authenticated SECURITY DEFINER RPCs: %', unexpected;
  end if;

  select array_agg(expected_name order by expected_name)
  into missing
  from unnest(allowed) expected_name
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = expected_name
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'execute')
  );

  if coalesce(cardinality(missing), 0) > 0 then
    raise exception 'Expected authenticated RPCs missing from the controlled surface: %', missing;
  end if;

  select count(*)
  into anon_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute');

  if anon_count <> 0 then
    raise exception '% anonymous SECURITY DEFINER RPCs remain exposed', anon_count;
  end if;
end;
$$;

rollback;
