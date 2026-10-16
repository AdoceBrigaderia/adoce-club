import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("conclusão financeira do caixa", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20261016142737_cash_partial_payroll_loyalty_audit.sql", import.meta.url), "utf8");

  it("mantém a conclusão operacional separada da quitação e recebe parcelas posteriores com idempotência", () => {
    expect(migration).toContain("staff_complete_partial_cash_sale");
    expect(migration).toContain("requested_amount numeric");
    expect(migration).toContain("requested_operation_key uuid");
    expect(migration).toContain("least(requested_amount, remaining_amount)");
  });

  it("vincula desconto em folha a funcionário ativo e não o trata como dinheiro disponível", () => {
    expect(migration).toContain("payroll_employee_id");
    expect(migration).toContain("staff_private_profiles");
    expect(migration).toContain("Funcionário inválido para desconto em folha");
  });

  it("concede os carimbos na conclusão operacional e prevê reversão compensatória auditada", () => {
    expect(migration).toContain("cash.loyalty_stamps_granted");
    expect(migration).toContain("staff_reverse_cash_sale_loyalty");
    expect(migration).toContain("related_entry_id");
    expect(migration).toContain("cash.loyalty_stamps_reversed");
  });
});
