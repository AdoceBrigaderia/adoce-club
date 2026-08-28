import { describe, expect, it } from "vitest";
import { buildThermalReceipt } from "./lib/thermal-printer";

describe("comanda térmica de 58 mm", () => {
  it("agrupa a calda logo abaixo de cada fatia", () => {
    const receipt = buildThermalReceipt({
      id: "1", order_number: "AD-123", customer_name: "Maria Silva",
      customer_phone: "85999999999", customer_notes: "Retirada: Cliente vai retirar",
      total: 48, created_at: "2026-08-03T12:00:00Z",
      instant_order_items: [{ id: "i1", flavor_name: "Red Velvet", quantity: 2,
        instant_order_item_sauces: [{ unit_number: 1, sauce_name: "Ninho" }, { unit_number: 2, sauce_name: "Ninho e Chocolate" }] }],
    });
    expect(receipt).toContain("[ ] Red Velvet\n    Calda: Ninho");
    expect(receipt).toContain("Calda: Ninho e Chocolate");
    expect(receipt).toContain("TOTAL: 02 FATIA(S)");
    expect(receipt).toContain("[ ] Embalado");
  });
});
