import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../supabase/migrations/20261012073000_cash_sale_customer_loyalty_atomic.sql", import.meta.url), "utf8");

describe("finalização atômica de fidelidade no caixa", () => {
  it("protege repetição, separa uma unidade e mantém baixa feita pela venda", () => {
    expect(sql).toContain("cash_customer_loyalty_requests");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("quantity = quantity - 1");
    expect(sql).toContain("is_reward = true");
    expect(sql).toContain("staff_create_manual_sale_in_cash_v6");
    expect(sql).not.toContain("staff_redeem_reward_slice(");
  });

  it("consome recompensa digital e lança apenas carimbos das fatias pagas", () => {
    expect(sql).toContain("staff_redeem_reward(");
    expect(sql).toContain("staff_record_purchase(");
    expect(sql).toContain("paid_quantity := total_quantity - 1");
    expect(sql).toContain("requested_reward_kind = 'manual'");
  });
});
