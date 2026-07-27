export const OPERATION_RPC_ALLOWLIST = [
  "staff_get_business_workspace",
  "staff_open_cash_session",
  "staff_record_cash_movement",
  "staff_close_cash_session",
  "manager_cancel_empty_cash_session",
  "manager_upsert_store",
  "manager_upsert_cash_register",
  "manager_set_staff_store_assignment",
  "manager_set_staff_capability",
  "manager_update_staff_member",
  "staff_create_manual_sale_in_cash",
  "manager_create_manual_sale_for_reconciliation",
  "staff_get_cash_reconciliation_queue",
  "manager_reconcile_cash_sale",
  "staff_get_quick_sale_catalog",
  "staff_set_quick_sale_favorite",
  "staff_adjust_loyalty_stamps",
  "staff_financial_sales_summary",
  "staff_get_commerce_settings",
  "staff_search_customers",
  "staff_lookup_customer_by_qr",
  "staff_list_active_customer_checkins",
  "staff_apply_customer_checkin_stamps",
  "staff_get_customer_360",
  "staff_add_customer_crm_note",
  "staff_set_customer_crm_tag",
  "staff_get_operational_reports",
  "manager_get_whatsapp_otp_metrics",
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
