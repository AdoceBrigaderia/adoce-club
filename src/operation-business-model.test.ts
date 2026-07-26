import { describe, expect, it } from "vitest";
import {
  defaultStorePermissions,
  expectedCashAmount,
  formatBusinessMoney,
  normalizeBusinessSlug,
  parseMoneyInput,
  roleLabel,
} from "./operation-business-model";

describe("estrutura operacional", () => {
  it("gera identificadores simples para lojas e caixas", () => {
    expect(normalizeBusinessSlug("Loja Passaré 01")).toBe("loja-passare-01");
    expect(normalizeBusinessSlug("  Caixa / Tablet A  ")).toBe("caixa-tablet-a");
  });

  it("interpreta valores em reais sem aceitar números negativos", () => {
    expect(parseMoneyInput("R$ 1.234,56")).toBe(1234.56);
    expect(parseMoneyInput("18,90")).toBe(18.9);
    expect(parseMoneyInput("-20")).toBe(0);
    expect(parseMoneyInput("texto")).toBe(0);
  });

  it("calcula o dinheiro esperado usando somente movimentos em espécie", () => {
    expect(expectedCashAmount(100, [
      { direction: "in", payment_method_code: "cash", amount: 75 },
      { direction: "out", payment_method_code: "cash", amount: 20 },
      { direction: "in", payment_method_code: "pix", amount: 300 },
    ])).toBe(155);
  });

  it("entrega permissões coerentes por função", () => {
    expect(defaultStorePermissions("owner").can_view_finance).toBe(true);
    expect(defaultStorePermissions("manager").can_close_cash).toBe(true);
    expect(defaultStorePermissions("attendant").can_sell).toBe(true);
    expect(defaultStorePermissions("attendant").can_open_cash).toBe(false);
    expect(defaultStorePermissions("viewer").can_sell).toBe(false);
  });

  it("traduz funções e moeda para a interface", () => {
    expect(roleLabel("owner")).toBe("Proprietário");
    expect(roleLabel("attendant")).toBe("Atendimento");
    expect(formatBusinessMoney(12.5)).toContain("12,50");
  });
});
