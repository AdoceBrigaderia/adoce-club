import { describe, expect, it } from "vitest";
import { CostEngine, calculateSale, decimal, money, type Ingredient, type Preparation } from "./cost-engine";

const ingredient: Ingredient = {
  id: "farinha", name: "Farinha", purchasePrice: "12.00",
  purchased: { value: "1", unit: "kg" }, useful: { value: "900", unit: "g" },
};
const prep: Preparation = {
  id: "massa", name: "Massa", yield: { value: "500", unit: "g" },
  components: [{ kind: "ingredient", id: "farinha", quantity: { value: "450", unit: "g" } }],
};
const engine = new CostEngine(new Map([[ingredient.id, ingredient]]), new Map([[prep.id, prep]]));

describe("motor de custos", () => {
  it("normaliza kg para g e utiliza rendimento útil sem duplicar a perda", () => {
    const result = engine.ingredient("farinha", { value: "450", unit: "g" });
    expect(result.status).toBe("CALCULADA");
    if (result.status === "CALCULADA") expect(money(result.micros)).toBe("6.00");
  });

  it("normaliza g para kg e L para ml", () => {
    const volume: Ingredient = { id: "leite", name: "Leite", purchasePrice: "8",
      purchased: { value: "2", unit: "l" } };
    const byVolume = new CostEngine(new Map([["leite", volume]]), new Map());
    const milk = byVolume.ingredient("leite", { value: "500", unit: "ml" });
    const flour = engine.ingredient("farinha", { value: "0.45", unit: "kg" });
    expect(milk.status).toBe("CALCULADA");
    expect(flour.status).toBe("CALCULADA");
    if (milk.status === "CALCULADA") expect(money(milk.micros)).toBe("2.00");
    if (flour.status === "CALCULADA") expect(money(flour.micros)).toBe("6.00");
  });

  it("calcula preparação e fatia com rendimento informado, sem alterar a ficha", () => {
    const variant = { size: "G" as const, sections: [{ name: "Massas", components: [{ kind: "preparation" as const, id: "massa", quantity: { value: "500", unit: "g" as const } }] }] };
    const result = engine.cake(variant, 10);
    expect(result.status).toBe("CALCULADA");
    if (result.status === "CALCULADA") {
      expect(money(result.micros)).toBe("6.00");
      expect(money(result.sliceMicros!)).toBe("0.60");
    }
    expect(engine.cake(variant).status).toBe("CALCULADA");
  });

  it("não inventa custos ausentes nem aceita unidades incompatíveis", () => {
    expect(new CostEngine(new Map(), new Map()).cake()).toEqual({ status: "INCOMPLETA", missing: ["Tamanho sem ficha"] });
    expect(engine.ingredient("farinha", { value: "1", unit: "ml" }).status).toBe("ERRO");
    expect(engine.cake({ size: "P", sections: [] }, 0).status).toBe("INCOMPLETA");
    expect(engine.cake({ size: "P", sections: [{ name: "massa", components: [] }] }).status).toBe("INCOMPLETA");
  });

  it("recusa divisão por zero e dados negativos na venda", () => {
    const result = engine.cake({ size: "M", sections: [{ name: "Massa", components: [
      { kind: "ingredient", id: "farinha", quantity: { value: "450", unit: "g" } },
    ] }] }, 0);
    expect(result.status).toBe("ERRO");
    expect(calculateSale({ slices: 1, sliceProductionMicros: decimal("6"), grossUnitPrice: "1",
      discountTotal: "2", itemPackagingMicros: 0n, orderPackagingMicros: 0n,
      percentageFee: "0", fixedFee: "0", loyalty: { mode: "none" } }).status).toBe("ERRO");
  });

  it("identifica ciclo completo entre preparações", () => {
    const a: Preparation = { id: "a", name: "A", yield: { value: "1", unit: "g" }, components: [{ kind: "preparation", id: "b", quantity: { value: "1", unit: "g" } }] };
    const b: Preparation = { id: "b", name: "B", yield: { value: "1", unit: "g" }, components: [{ kind: "preparation", id: "a", quantity: { value: "1", unit: "g" } }] };
    const result = new CostEngine(new Map(), new Map([["a", a], ["b", b]])).preparation("a", { value: "1", unit: "g" });
    expect(result).toEqual({ status: "ERRO", missing: ["Dependência circular: a → b → a"] });
  });

  it("mantém dinheiro decimal preciso", () => {
    expect(decimal("0.1") + decimal("0.2")).toBe(decimal("0.3"));
    expect(money(decimal("1.235"))).toBe("1.24");
  });

  it("separa embalagem por fatia e por pedido, taxa e provisão de fidelidade", () => {
    const result = calculateSale({ slices: 5, sliceProductionMicros: decimal("6"),
      grossUnitPrice: "16", discountTotal: "0", itemPackagingMicros: decimal("0.5"),
      orderPackagingMicros: decimal("1"), percentageFee: "0.05", fixedFee: "0",
      loyalty: { mode: "provision", pointsGranted: 5, pointsNeeded: 14,
        expectedRewardMicros: decimal("7") } });
    expect(result.status).toBe("CALCULADA");
    if (result.status === "CALCULADA") {
      expect(money(result.physicalMicros)).toBe("30.00");
      expect(money(result.commercialMicros)).toBe("10.00");
      expect(money(result.contributionMicros)).toBe("40.00");
      expect(result.marginMillionths).toBe(500000n);
    }
  });

  it("compensa provisão no resgate e não a contabiliza duas vezes", () => {
    const result = calculateSale({ slices: 1, sliceProductionMicros: decimal("6"),
      grossUnitPrice: "0", discountTotal: "0", itemPackagingMicros: decimal("1"),
      orderPackagingMicros: 0n, percentageFee: "0", fixedFee: "0",
      loyalty: { mode: "redemption", realizedRewardMicros: decimal("7"), releasedProvisionMicros: decimal("7") } });
    expect(result.status).toBe("CALCULADA");
    if (result.status === "CALCULADA") {
      expect(money(result.commercialMicros)).toBe("-6.00");
      expect(money(result.contributionMicros)).toBe("0.00");
    }
  });
});
