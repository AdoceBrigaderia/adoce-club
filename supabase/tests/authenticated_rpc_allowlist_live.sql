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
    'staff_anonymize_privacy_profile',
    'staff_apply_customer_checkin_stamps',
    'staff_apply_privacy_consent_change',
    'staff_apply_privacy_name_correction',
    'staff_close_cash_session',
    'staff_create_manual_sale_in_cash',
    'staff_create_manual_sale_in_cash_v2',
    'staff_financial_sales_summary',
    'staff_get_business_workspace',
    'staff_get_cake_builder_configuration',
    'staff_get_cash_reconciliation_queue',
    'staff_get_commerce_settings',
    'staff_get_customer_360',
    'staff_get_operational_reports',
    'staff_get_privacy_anonymization_plan',
    'staff_get_quick_sale_catalog',
    'staff_list_active_customer_checkins',
    'staff_list_privacy_requests',
    'staff_lookup_customer_by_qr',
    'staff_mark_privacy_response_delivered',
    'staff_open_cash_session',
    'staff_prepare_privacy_access_response',
    'staff_record_cash_movement',
    'staff_record_cash_movement_v2',
    'staff_review_privacy_anonymization',
    'staff_search_customers',
    'staff_set_customer_crm_tag',
    'staff_set_quick_sale_favorite',
    'staff_update_commerce_settings',
    'staff_update_privacy_request',
    'staff_verify_privacy_request_identity',
    'submit_instant_order_v5',
    'submit_instant_order_v6',
    'public_get_cake_builder_catalog',
    'manager_save_cake_builder_configuration',
    'manager_get_cake_builder_costing_workspace',
    'manager_save_cake_builder_costing_links',
    'manager_get_costing_catalog_workspace',
    'manager_save_costing_catalog_item',
    'manager_add_costing_item_price',
    'manager_get_product_profitability_workspace',
    'manager_save_product_costing_settings',
    'manager_save_product_yield_override',
    'manager_capture_product_yield_sale_snapshot',
    'manager_get_service_request_pricing_snapshot',
    'manager_assert_site_visual_access',
    'manager_get_site_visual_assets_workspace',
    'manager_list_site_visual_asset_versions',
    'manager_save_site_visual_asset',
    'manager_reset_site_visual_asset',
    'manager_restore_site_visual_asset_version',
    'manager_assert_dynamic_image_access',
    'manager_get_dynamic_image_workspace',
    'manager_save_dynamic_image_asset',
    'manager_list_dynamic_image_versions',
    'manager_restore_dynamic_image_version'
  ];
  required text[] := array[
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
    'staff_anonymize_privacy_profile',
    'staff_apply_customer_checkin_stamps',
    'staff_apply_privacy_consent_change',
    'staff_apply_privacy_name_correction',
    'staff_close_cash_session',
    'staff_financial_sales_summary',
    'staff_get_business_workspace',
    'staff_get_cash_reconciliation_queue',
    'staff_get_commerce_settings',
    'staff_get_customer_360',
    'staff_get_operational_reports',
    'staff_get_privacy_anonymization_plan',
    'staff_get_quick_sale_catalog',
    'staff_list_active_customer_checkins',
    'staff_list_privacy_requests',
    'staff_lookup_customer_by_qr',
    'staff_mark_privacy_response_delivered',
    'staff_open_cash_session',
    'staff_prepare_privacy_access_response',
    'staff_review_privacy_anonymization',
    'staff_search_customers',
    'staff_set_customer_crm_tag',
    'staff_set_quick_sale_favorite',
    'staff_update_commerce_settings',
    'staff_update_privacy_request',
    'staff_verify_privacy_request_identity'
  ];
  transitional text[][] := array[
    array['staff_create_manual_sale_in_cash', 'staff_create_manual_sale_in_cash_v2'],
    array['staff_record_cash_movement', 'staff_record_cash_movement_v2'],
    array['submit_instant_order_v5', 'submit_instant_order_v6']
  ];
  allowed_anon text[] := array['public_get_cake_builder_catalog'];
  unexpected text[];
  missing text[];
  unexpected_anon text[];
  transition_group text[];
  transition_count integer;
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
  from unnest(required) expected_name
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

  foreach transition_group slice 1 in array transitional loop
    select count(distinct p.proname)
    into transition_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'execute')
      and p.proname = any(transition_group);

    if transition_count <> 1 then
      raise exception 'Expected exactly one controlled RPC version from %, found %',
        transition_group, transition_count;
    end if;
  end loop;

  select array_agg(distinct p.proname order by p.proname)
  into unexpected_anon
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute')
    and not (p.proname = any(allowed_anon));

  if coalesce(cardinality(unexpected_anon), 0) > 0 then
    raise exception 'Unexpected anonymous SECURITY DEFINER RPCs: %',
      unexpected_anon;
  end if;
end;
$$;

rollback;
