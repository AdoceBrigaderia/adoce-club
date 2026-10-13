import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("formas de pagamento do pedido público", () => {
  const panel = readFileSync("src/InstantOrderPanel.tsx", "utf8");
  const migration = readFileSync("supabase/migrations/20261007030625_online_orders_pix_only.sql", "utf8");

  it("limita a escolha online no banco e preserva os meios internos", () => {
    expect(migration).toContain("where method.code = 'pix' and method.active and method.customer_selectable");
    expect(migration).toContain("target.sales_channel in ('site', 'pede_junto')");
    expect(migration).toContain("requested_method_code is distinct from 'pix'");
  });

  it("mostra Pix sem oferecer outro meio no pedido individual", () => {
    expect(panel).toContain('const paymentMethod = "pix"');
    expect(panel).toContain("Pagamento por Pix.");
    expect(panel).not.toContain("Como deseja pagar?");
  });
});
