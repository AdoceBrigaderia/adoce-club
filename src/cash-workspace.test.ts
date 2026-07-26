import { describe, expect, it } from "vitest";
import {
  assignmentAllows,
  calculateCashDifference,
  calculateExpectedCash,
  cashMovementDelta,
  numericMoney,
  slugifyBusinessCode,
} from "./cash-workspace";

describe("regras de lojas, permissoes e caixa", () => {
  it("considera somente dinheiro físico no valor esperado", () => {
    expect(calculateExpectedCash(100, [
      { direction: "in", payment_method_code: "cash", amount: 50 },
      { direction: "in", payment_method_code: "pix", amount: 80 },
      { direction: "out", payment_method_code: "cash", amount: 20 },
    ])).toBe(130);
  });

  it("calcula diferença positiva e negativa no fechamento", () => {
    expect(calculateCashDifference(130, 132.5)).toBe(2.5);
    expect(calculateCashDifference(130, 127.75)).toBe(-2.25);
  });

  it("normaliza valores monetários inválidos e casas decimais", () => {
    expect(numericMoney("10.126")).toBe(10.13);
    expect(numericMoney("invalido")).toBe(0);
  });

  it("gera códigos simples para lojas e caixas", () => {
    expect(slugifyBusinessCode("Loja Passaré / Caixa 01")).toBe("loja-passare-caixa-01");
  });

  it("gestores recebem permissões administrativas", () => {
    expect(assignmentAllows("owner", null, "can_close_cash")).toBe(true);
    expect(assignmentAllows("manager", null, "can_open_cash")).toBe(true);
  });

  it("atendimento depende da atribuição ativa", () => {
    const assignment = {
      active: true,
      can_sell: true,
      can_open_cash: false,
      can_close_cash: false,
      can_manage_stock: false,
      can_view_finance: false,
    };
    expect(assignmentAllows("attendant", assignment, "can_sell")).toBe(true);
    expect(assignmentAllows("attendant", assignment, "can_open_cash")).toBe(false);
  });

  it("transforma saídas em valores negativos", () => {
    expect(cashMovementDelta({ direction: "out", payment_method_code: "cash", amount: 15 })).toBe(-15);
    expect(cashMovementDelta({ direction: "out", payment_method_code: "credit_card", amount: 15 })).toBe(0);
  });
});
