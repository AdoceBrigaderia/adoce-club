export const OPERATION_RPC_ALLOWLIST = [
  "staff_get_business_workspace",
  "staff_open_cash_session",
  "staff_record_cash_movement_v2",
  "staff_close_cash_session",
  "manager_cancel_empty_cash_session",
  "manager_upsert_store",
  "manager_upsert_cash_register",
  "manager_set_staff_store_assignment",
  "manager_set_staff_capability",
  "manager_update_staff_member",
  "staff_create_manual_sale_in_cash_v2",
  "manager_create_manual_sale_for_reconciliation",
  "staff_get_cash_reconciliation_queue",
  "manager_reconcile_cash_sale",
  "staff_get_quick_sale_catalog",
  "staff_set_quick_sale_favorite",
  "staff_adjust_loyalty_stamps",
  "staff_financial_sales_summary",
  "staff_get_commerce_settings",
  "staff_update_commerce_settings",
  "staff_get_service_request_workspace",
  "staff_transition_service_request",
  "staff_transition_service_request_production",
  "manager_get_configurable_product_workspace",
  "manager_save_configurable_product",
  "staff_get_cake_builder_configuration",
  "manager_save_cake_builder_configuration",
  "manager_get_cake_builder_costing_workspace",
  "manager_save_cake_builder_costing_links",
  "manager_get_costing_catalog_workspace",
  "manager_save_costing_catalog_item",
  "manager_add_costing_item_price",
  "manager_get_product_profitability_workspace",
  "manager_save_product_costing_settings",
  "manager_save_product_yield_override",
  "manager_capture_product_yield_sale_snapshot",
  "manager_get_service_request_pricing_snapshot",
  "manager_get_site_visual_assets_workspace",
  "manager_list_site_visual_asset_versions",
  "manager_reset_site_visual_asset",
  "manager_restore_site_visual_asset_version",
  "manager_get_dynamic_image_workspace",
  "manager_save_dynamic_image_asset",
  "manager_list_dynamic_image_versions",
  "manager_restore_dynamic_image_version",
  "manager_get_gallery_media_workspace",
  "manager_disable_gallery_media",
  "manager_list_gallery_media_versions",
  "manager_restore_gallery_media_version",
  "staff_search_customers",
  "staff_lookup_customer_by_qr",
  "staff_list_active_customer_checkins",
  "staff_apply_customer_checkin_stamps",
  "staff_get_customer_360",
  "staff_get_customer_service_request_history",
  "staff_add_customer_crm_note",
  "staff_set_customer_crm_tag",
  "staff_get_operational_reports",
  "manager_get_whatsapp_otp_metrics",
  "staff_list_privacy_requests",
  "staff_update_privacy_request",
  "staff_verify_privacy_request_identity",
  "staff_prepare_privacy_access_response",
  "staff_mark_privacy_response_delivered",
  "staff_apply_privacy_name_correction",
  "staff_apply_privacy_consent_change",
  "staff_review_privacy_anonymization",
  "staff_get_privacy_anonymization_plan",
  "staff_anonymize_privacy_profile",
] as const;

export const CLIENT_RPC_ALLOWLIST = [
  "customer_create_store_checkin",
  "customer_get_account_workspace",
  "issue_customer_qr",
] as const;

export type OperationBffRpcName = (typeof OPERATION_RPC_ALLOWLIST)[number];
export type ClientBffRpcName = (typeof CLIENT_RPC_ALLOWLIST)[number];

const allowedOperationRpcs = new Set<string>(OPERATION_RPC_ALLOWLIST);
const allowedClientRpcs = new Set<string>(CLIENT_RPC_ALLOWLIST);

export function isAllowedOperationRpc(value: unknown): value is OperationBffRpcName {
  return typeof value === "string" && allowedOperationRpcs.has(value);
}

export function isAllowedClientRpc(value: unknown): value is ClientBffRpcName {
  return typeof value === "string" && allowedClientRpcs.has(value);
}
