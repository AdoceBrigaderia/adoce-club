export const OPERATION_RPC_ALLOWLIST = [
  "staff_get_business_workspace",
  "staff_open_cash_session",
  "staff_record_cash_movement",
  "staff_close_cash_session",
  "manager_cancel_empty_cash_session",
  "manager_upsert_store",
  "manager_upsert_cash_register",
  "manager_set_staff_store_assignment",
  "manager_update_staff_member",
  "staff_create_manual_sale_in_cash",
] as const;

export type OperationBffRpcName = (typeof OPERATION_RPC_ALLOWLIST)[number];

const allowedOperationRpcs = new Set<string>(OPERATION_RPC_ALLOWLIST);

export function isAllowedOperationRpc(value: unknown): value is OperationBffRpcName {
  return typeof value === "string" && allowedOperationRpcs.has(value);
}
