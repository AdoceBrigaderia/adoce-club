import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727035246_operational_foreign_key_indexes.sql",
    import.meta.url,
  ),
  "utf8",
);

const expectedIndexes = [
  "instant_orders_store_id_idx",
  "instant_orders_cash_session_id_idx",
  "instant_orders_cash_register_id_idx",
  "instant_orders_pickup_location_id_idx",
  "instant_orders_payment_method_code_idx",
  "instant_order_items_flavor_id_idx",
  "cash_movements_order_id_idx",
  "cash_movements_register_id_idx",
  "cash_movements_payment_method_code_idx",
  "cash_reconciliation_queue_session_id_idx",
  "customer_checkins_register_id_idx",
  "service_requests_product_id_idx",
  "service_requests_assigned_to_idx",
  "crm_tasks_profile_id_idx",
  "crm_tasks_service_request_id_idx",
  "crm_tasks_assigned_to_idx",
  "crm_notes_service_request_id_idx",
];

describe("índices das relações críticas da operação", () => {
  it("cria todos os índices esperados de forma idempotente", () => {
    for (const index of expectedIndexes) {
      expect(migration).toContain(`create index if not exists ${index}`);
    }
  });

  it("prioriza pedidos, caixa, check-in e CRM", () => {
    for (const table of [
      "public.instant_orders",
      "public.cash_movements",
      "public.cash_reconciliation_queue",
      "public.customer_checkins",
      "public.service_requests",
      "public.crm_tasks",
    ]) {
      expect(migration).toContain(table);
    }
  });

  it("usa índices parciais quando a relação é opcional", () => {
    expect(migration).toContain("where cash_session_id is not null");
    expect(migration).toContain("where assigned_to is not null");
    expect(migration).toContain("where service_request_id is not null");
  });
});
