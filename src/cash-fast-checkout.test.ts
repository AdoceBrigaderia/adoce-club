import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { singlePayment, addSplitPayment, paymentBalance, cashDayRange, partialPaymentError, payrollEmployeeError } from "./cash-fast-checkout";

describe("fechamento rápido do caixa", () => {
  it("preserva e recupera o pedido em andamento ao navegar", () => {
    const source = readFileSync(new URL("./OperationManualSale.tsx", import.meta.url), "utf8");
    expect(source).toContain("cashDraftStorageKey");
    expect(source).toContain("sessionStorage.setItem");
    expect(source).toContain("sessionStorage.getItem");
    expect(source).toContain("5 * 60 * 1000");
  });
  it("mostra estoque físico, reservado, livre e a reserva do pedido atual", () => {
    const source = readFileSync(new URL("./OperationManualSale.tsx", import.meta.url), "utf8");
    for (const label of ["Estoque:", "Reservado:", "Livre:", "Neste pedido:"]) expect(source).toContain(label);
  });
  it("registra o total exato para Pix e cartões sem digitar valor", () => {
    for (const method of ["pix", "credit_card", "debit_card", "payroll"] as const)
      expect(singlePayment(31.9, method)).toEqual([{method, amount:31.9}]);
  });
  it("preenche dinheiro com o total e calcula o troco do valor recebido", () => {
    expect(paymentBalance(31.9, singlePayment(31.9, "cash"))).toEqual({paid:31.9,remaining:0,change:0});
    expect(paymentBalance(31.9, singlePayment(31.9, "cash", "50,00"))).toEqual({paid:50,remaining:0,change:18.1});
    expect(() => singlePayment(31.9,"cash","20")).toThrow();
    expect(() => singlePayment(31.9,"cash","abc")).toThrow();
  });
  it("exige valores no dividido e só completa quando a soma cobre o total", () => {
    const first = addSplitPayment(31.9,[],"pix","10");
    expect(paymentBalance(31.9,first).remaining).toBe(21.9);
    const second = addSplitPayment(31.9,first,"credit_card","21,90");
    expect(paymentBalance(31.9,second).remaining).toBe(0);
    expect(() => addSplitPayment(31.9,first,"credit_card","")).toThrow();
    expect(() => addSplitPayment(31.9,first,"credit_card","30")).toThrow();
    expect(paymentBalance(31.9,addSplitPayment(31.9,first,"cash","30")).change).toBe(8.1);
  });
  it("usa o dia de Fortaleza, inclusive com virada do dia em UTC", () => {
    expect(cashDayRange(new Date("2026-10-09T01:30:00Z"))).toEqual({day:"2026-10-08",start:"2026-10-08T03:00:00.000Z",end:"2026-10-09T03:00:00.000Z"});
  });
  it("permite concluir operacionalmente uma venda parcialmente paga quando o cliente foi informado", () => {
    expect(partialPaymentError("Maria", 12)).toBe("");
    expect(partialPaymentError("", 12)).toBe("Informe o nome do cliente para deixar o saldo pendente.");
    expect(partialPaymentError("Maria", 0)).toBe("Não há saldo pendente nesta venda.");
  });
  it("exige funcionário em qualquer pagamento por desconto em folha", () => {
    expect(payrollEmployeeError([{method:"payroll", amount:16}], "")).toBe("Selecione o funcionário para o desconto em folha.");
    expect(payrollEmployeeError([{method:"payroll", amount:16}], "func-1")).toBe("");
    expect(payrollEmployeeError([{method:"pix", amount:16}], "")).toBe("");
  });
});
