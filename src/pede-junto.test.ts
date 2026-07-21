import { describe, expect, it } from "vitest";
import { buildPedeJuntoWhatsAppMessage, progressCopy, roomProgressCopy, type PedeJuntoRoom } from "./pede-junto";

const room = (total: number): PedeJuntoRoom => ({
  id: "group-1", public_code: "JUNTO123", name: "Condomínio Feliz", organizer_name: "Beth",
  delivery_address: "Rua A, 10", delivery_reference: null, minimum_slices: 5,
  total_slices: total, total_value: total * 16, status: "open",
  closes_at: new Date(Date.now() + 60_000).toISOString(), free_delivery: total >= 5, participants: [],
});

describe("Pede Junto Adoce", () => {
  it("libera a entrega na quinta fatia sem criar limite máximo", () => {
    expect(progressCopy(4).tone).toBe("building");
    expect(progressCopy(5).tone).toBe("unlocked");
    expect(progressCopy(9).message).toContain("continua aberto");
    expect(progressCopy(10).tone).toBe("celebration");
    expect(progressCopy(27).message).toContain("ainda cabe mais gente");
  });

  it("explica no convite que cada pessoa paga o próprio pedido", () => {
    const message = buildPedeJuntoWhatsAppMessage(room(12), "https://adocebrigaderia.com.br/#pede-junto");
    expect(message).toContain("12 fatias");
    expect(message).toContain("grupo continua aberto");
    expect(message).toContain("Cada um escolhe e paga o seu");
  });

  it("encerra a comunicação do grupo depois da entrega", () => {
    const delivered = { ...room(12), status: "completed" as const };
    const copy = roomProgressCopy(delivered);
    expect(copy.title).toBe("12 fatias entregues");
    expect(copy.message).toContain("grupo está encerrado");
    expect(copy.message).not.toContain("continua aberto");
  });
});
