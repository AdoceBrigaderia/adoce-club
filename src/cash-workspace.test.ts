import { describe, expect, it } from "vitest";
import {
  assignmentAllows,
  calculateCashDifference,
  calculateExpectedCash,
  cashMovementDelta,
  numericMoney,
  roleAllowsCapability,
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

  it("mantém owner e manager com acesso administrativo integral", () => {
    expect(assignmentAllows("owner", null, "can_close_cash")).toBe(true);
    expect(assignmentAllows("manager", null, "can_view_finance")).toBe(true);
  });

  it("aplica teto de capacidades aos seis papéis operacionais", () => {
    expect(roleAllowsCapability("attendant", "can_sell")).toBe(true);
    expect(roleAllowsCapability("attendant", "can_open_cash")).toBe(false);
    expect(roleAllowsCapability("cashier", "can_open_cash")).toBe(true);
    expect(roleAllowsCapability("cashier", "can_view_finance")).toBe(false);
    expect(roleAllowsCapability("production", "can_manage_stock")).toBe(true);
    expect(roleAllowsCapability("production", "can_sell")).toBe(false);
    expect(roleAllowsCapability("viewer", "can_sell")).toBe(false);
    expect(roleAllowsCapability("papel-invalido", "can_sell")).toBe(false);
  });

  it("não permite que flags antigas ampliem o papel atual", () => {
    const permissiveAssignment = {
      active: true,
      can_sell: true,
      can_open_cash: true,
      can_close_cash: true,
      can_manage_stock: true,
      can_view_finance: true,
    };

    expect(assignmentAllows("attendant", permissiveAssignment, "can_sell")).toBe(true);
    expect(assignmentAllows("attendant", permissiveAssignment, "can_open_cash")).toBe(false);
    expect(assignmentAllows("cashier", permissiveAssignment, "can_close_cash")).toBe(true);
    expect(assignmentAllows("cashier", permissiveAssignment, "can_manage_stock")).toBe(false);
    expect(assignmentAllows("production", permissiveAssignment, "can_manage_stock")).toBe(true);
    expect(assignmentAllows("production", permissiveAssignment, "can_sell")).toBe(false);
    expect(assignmentAllows("viewer", permissiveAssignment, "can_sell")).toBe(false);
  });

  it("exige atribuição ativa para papéis vinculados à loja", () => {
    const assignment = {
      active: false,
      can_sell: true,
      can_open_cash: true,
      can_close_cash: true,
      can_manage_stock: true,
      can_view_finance: true,
    };
    expect(assignmentAllows("cashier", assignment, "can_sell")).toBe(false);
    expect(assignmentAllows("production", assignment, "can_manage_stock")).toBe(false);
  });

  it("transforma saídas em valores negativos", () => {
    expect(cashMovementDelta({ direction: "out", payment_method_code: "cash", amount: 15 })).toBe(-15);
    expect(cashMovementDelta({ direction: "out", payment_method_code: "credit_card", amount: 15 })).toBe(0);
  });
});
