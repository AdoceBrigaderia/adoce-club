import { describe, expect, it } from "vitest";
import { requestFilterMatches, requestIsPastDue, requestTransitions } from "./OperationCommercialAdmin";

describe("fluxo operacional de pedidos", () => {
  it("mostra somente a próxima ação coerente para cada etapa", () => {
    expect(requestTransitions.prebooked).toEqual(["quoted"]);
    expect(requestTransitions.awaiting_deposit).toEqual(["confirmed"]);
    expect(requestTransitions.confirmed).toEqual(["in_production"]);
    expect(requestTransitions.ready).toEqual(["completed"]);
    expect(requestTransitions.completed).toEqual([]);
  });

  it("separa a fila ativa do histórico encerrado", () => {
    expect(requestFilterMatches("prebooked", "active")).toBe(true);
    expect(requestFilterMatches("cancelled", "active")).toBe(false);
    expect(requestFilterMatches("expired", "cancelled")).toBe(true);
    expect(requestFilterMatches("completed", "completed")).toBe(true);
  });

  it("permite reabrir solicitações canceladas ou expiradas sem apagar histórico", () => {
    expect(requestTransitions.cancelled).toEqual(["prebooked"]);
    expect(requestTransitions.expired).toEqual(["prebooked"]);
  });

  it("destaca pré-reserva vencida sem tratar pedido confirmado como vencido", () => {
    expect(requestIsPastDue({ status: "prebooked", expires_at: "2026-07-20T10:00:00Z" }, Date.parse("2026-07-21T10:00:00Z"))).toBe(true);
    expect(requestIsPastDue({ status: "confirmed", expires_at: "2026-07-20T10:00:00Z" }, Date.parse("2026-07-21T10:00:00Z"))).toBe(false);
  });
});
