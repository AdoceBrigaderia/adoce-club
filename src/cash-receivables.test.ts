import { describe, expect, it } from "vitest";
import { validateDeferredSale, closingReceipt, splitChange } from "./cash-receivables";

describe("venda com pagamento pendente", () => {
  it("mantém na gaveta o troco devolvido por Pix", () => {
    expect(splitChange(18, 18)).toEqual({ cash: 0, pix: 18 });
    expect(splitChange(18, 8)).toEqual({ cash: 10, pix: 8 });
    expect(() => splitChange(18, 19)).toThrow();
  });
  it("aceita só o primeiro nome, sem exigir telefone", () => {
    expect(validateDeferredSale("Myrna")).toBe("");
    expect(validateDeferredSale(" Ana   Souza ")).toBe("");
    expect(validateDeferredSale("   ")).toBeTruthy();
    expect(validateDeferredSale("A")).toBeTruthy();
  });
  it("Caixa oferece desconto em folha e fidelidade do cartão de papel", async () => {
    const { readFileSync } = await import("node:fs");
    const cash = readFileSync("src/OperationManualSale.tsx", "utf8");
    const migration = readFileSync("supabase/migrations/20260926010000_payroll_loyalty_and_single_name_deferred.sql", "utf8");
    expect(cash).toContain('["cash","pix","credit_card","debit_card","payroll"]');
    expect(cash).toContain('rpc("staff_create_loyalty_cash_sale"');
    expect(cash).toContain("Fidelidade (cartão de papel)");
    expect(migration).toContain("values ('payroll', 'Desconto em folha'");
    expect(migration).toContain("new.customer_name ~ '\\S{2,}'");
  });
  it("separa recebimentos das vendas pendentes no fechamento", () => {
    const text = closingReceipt({ session: { id: "1", opening_float: 20, counted_cash: 30, expected_cash: 30, cash_difference: 0 }, slices: [{ name: "Ninho", quantity: 3 }], payments: [{ method: "cash", amount: 10 }, { method: "pix", amount: 16 }], pending: [{ customer_name: "Ana Souza", order_number: "FAT-1", remaining: 16 }] });
    expect(text).toContain("TOTAL DE FATIAS: 3");
    expect(text).toContain("Dinheiro: R$ 10,00");
    expect(text).toContain("Ana Souza");
    expect(text).toContain("PAGAMENTOS PENDENTES");
  });
});
