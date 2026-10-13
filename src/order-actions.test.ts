import { describe, expect, it } from "vitest";
import { canStartPreparation, canReceivePayment, canCancelOrder, canApplyExistingOrderReward } from "./order-actions";

describe("ações da operação", () => {
  it("permite escolher fidelidade durante a separação somente antes do pagamento", () => {
    expect(canApplyExistingOrderReward("preparing", "not_started")).toBe(true);
    expect(canApplyExistingOrderReward("reserved", "pending")).toBe(true);
    expect(canApplyExistingOrderReward("preparing", "approved")).toBe(false);
    expect(canApplyExistingOrderReward("preparing", "pending", "2026-10-10T17:00:00Z")).toBe(false);
    for (const status of ["paid", "ready", "completed", "cancelled", "expired"]) {
      expect(canApplyExistingOrderReward(status, "not_started")).toBe(false);
    }
  });
  it("permite separar uma reserva ainda não paga", () => {
    expect(canStartPreparation("reserved")).toBe(true);
    expect(canStartPreparation("awaiting_confirmation")).toBe(false);
    expect(canStartPreparation("expired")).toBe(false);
  });
  it("recebe pagamento inclusive após iniciar a separação", () => {
    expect(canReceivePayment("preparing", "not_started")).toBe(true);
    expect(canReceivePayment("preparing", "approved")).toBe(false);
    expect(canReceivePayment("expired", "expired")).toBe(false);
  });
  it("retira expirados da fila preservando os pedidos finalizados", () => {
    expect(canCancelOrder("expired")).toBe(true);
    expect(canCancelOrder("completed")).toBe(false);
    expect(canCancelOrder("cancelled")).toBe(false);
  });
});
