import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("proteção de pagamento dos pedidos de fatias", () => {
  const migration = readFileSync("supabase/migrations/20260807063006_instant_order_payment_guard_20260803.sql", "utf8");

  it("bloqueia pronto e entregue quando o pagamento não está aprovado", () => {
    expect(migration).toContain("new.status in ('ready', 'completed')");
    expect(migration).toContain("new.payment_status is distinct from 'approved'");
    expect(migration).toContain("instant_orders_require_payment_before_ready");
  });

  it("inclui a combinação de caldas usada na operação", () => {
    expect(migration).toContain("Calda de Ninho e chocolate");
  });
});
