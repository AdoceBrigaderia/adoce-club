import { describe, expect, it } from "vitest";
import { buildOrderWhatsAppMessage, orderWhatsAppUrl } from "./order-whatsapp";

describe("fechamento do pedido pelo WhatsApp", () => {
  const message = buildOrderWhatsAppMessage({
    orderNumber: "1045",
    customerName: "Maria Oliveira",
    items: [
      { name: "Surpresa de Uva", sauce: "Ninho" },
      { name: "Red Velvet", sauce: "Ninho" },
      { name: "Red Velvet", sauce: "Ninho e Chocolate" },
    ],
    total: 48,
    pickupTime: "20:00",
    pickupMethod: "customer",
  });

  it("organiza pedido, cliente, produtos, caldas, total e retirada", () => {
    expect(message).toContain("Olá, Adoce! Quero fazer uma reserva.");
    expect(message).toContain("Pedido: #ADOCE-1045");
    expect(message).toContain("Cliente: Maria Oliveira");
    expect(message).toContain("- 01 Surpresa de Uva\n- Calda: Ninho");
    expect(message).toContain("- 01 Red Velvet\n- Calda: Ninho e Chocolate");
    expect(message).toContain("Total: 03 fatias");
    expect(message).toContain("Valor: R$ 48,00");
    expect(message).toContain("Retirada: hoje às 20h");
    expect(message).toContain("Local: Cantinho Adoce");
  });

  it("abre o número comercial com a mensagem codificada", () => {
    const url = orderWhatsAppUrl("(85) 98215-6026", message);
    expect(url).toMatch(/^https:\/\/wa\.me\/5585982156026\?text=/);
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(message);
  });
});
