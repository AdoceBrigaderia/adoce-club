import { describe, expect, it } from "vitest";
import { normalizeCashPhone, resolveLoyaltyMode, rewardUnitOptions } from "./cash-customer-selector";

describe("identificação e fidelidade no caixa", () => {
  it("normaliza telefone brasileiro para pesquisa", () => {
    expect(normalizeCashPhone("(85) 9 8765-4321")).toBe("5585987654321");
    expect(normalizeCashPhone("+55 85 98765-4321")).toBe("5585987654321");
  });

  it("impede fidelidade manual quando existe cliente identificado", () => {
    expect(resolveLoyaltyMode({ customerId: "cliente", manualUnitKey: "oreo:1", digitalUnitKey: "" })).toEqual({ manualUnitKey: "", manualDisabled: true });
    expect(resolveLoyaltyMode({ customerId: "", manualUnitKey: "oreo:1", digitalUnitKey: "" })).toEqual({ manualUnitKey: "oreo:1", manualDisabled: false });
  });

  it("oferece cada unidade real do carrinho como candidata à cortesia", () => {
    expect(rewardUnitOptions([{ flavorId: "oreo", name: "Oreo", quantity: 2 }, { flavorId: "red", name: "Red", quantity: 1 }])).toEqual([
      { key: "oreo:1", flavorId: "oreo", unitNumber: 1, label: "Oreo · fatia 1" },
      { key: "oreo:2", flavorId: "oreo", unitNumber: 2, label: "Oreo · fatia 2" },
      { key: "red:1", flavorId: "red", unitNumber: 1, label: "Red · fatia 1" },
    ]);
  });
});
