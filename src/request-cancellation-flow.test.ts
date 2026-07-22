import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("cancelamento de pedidos na operação", () => {
  const source = readFileSync(new URL("./OperationCommercialAdmin.tsx", import.meta.url), "utf8");

  it("explica o motivo obrigatório junto da ação e só habilita a confirmação quando válido", () => {
    expect(source).toContain("Conte o motivo em mais");
    expect(source).toContain("Motivo pronto para ser registrado no histórico.");
    expect(source).toContain("busy || cancellationReason.trim().length < 5");
  });

  it("preserva o pedido cancelado no histórico em vez de apagá-lo sem rastreabilidade", () => {
    expect(source).toContain("O pedido sairá da fila ativa, mas continuará no histórico para consulta.");
    expect(source).toContain('next_status: "cancelled"');
    expect(source).toContain('setRequestFilter("cancelled")');
    expect(source).toContain("foi cancelado e movido para o histórico de cancelados");
    expect(source).not.toContain('await updateRequest({ ...request, internal_notes: internalNotes }, "cancelled")');
  });
});
