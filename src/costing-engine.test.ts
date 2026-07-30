import { describe, expect, it } from "vitest";
import {
  calculateChannelPrice,
  calculateCostSnapshot,
  calculateEnergyCost,
  calculateGasCost,
  calculateLaborCost,
  calculateMonthlyDepreciation,
  componentCost,
} from "./costing-engine";

describe("motor de custos produtivos", () => {
  it("calcula custo líquido considerando perda aproveitável", () => {
    expect(
      componentCost({
        id: "morango",
        label: "Morango",
        quantity: 800,
        unitCost: 0.02,
        lossPercent: 20,
      }),
    ).toBe(20);
  });

  it("rateia energia do ciclo entre os produtos realmente produzidos", () => {
    expect(
      calculateEnergyCost({
        powerWatts: 2_000,
        equipmentCount: 3,
        hours: 0.5,
        tariffPerKwh: 1,
        sharedUnits: 2,
      }),
    ).toBe(1.5);
  });

  it("não multiplica mão de obra por preparações paralelas", () => {
    expect(
      calculateLaborCost({
        hourlyCost: 24,
        activeMinutes: 30,
        workers: 1,
        sharedUnits: 3,
      }),
    ).toBe(4);
  });

  it("rateia gás entre preparações do mesmo lote", () => {
    expect(
      calculateGasCost({
        consumptionPerHour: 1.2,
        hours: 0.5,
        unitPrice: 8,
        sharedUnits: 3,
      }),
    ).toBe(1.6);
  });

  it("calcula depreciação linear mensal", () => {
    expect(calculateMonthlyDepreciation(3_600, 0, 36)).toBe(100);
  });

  it("consolida custo total e custo por fatia com snapshot versionado", () => {
    const snapshot = calculateCostSnapshot({
      recipeVersionId: "receita-v7",
      calculatedAt: "2026-07-28T08:30:00.000Z",
      dataStatus: "validated",
      yieldUnits: 13,
      directComponents: [
        { id: "massa", label: "Massas", quantity: 3, unitCost: 8 },
        { id: "recheio", label: "Recheios", quantity: 2, unitCost: 10 },
      ],
      packaging: [{ id: "caixa", label: "Caixa", quantity: 1, unitCost: 6 }],
      labor: [{ id: "montagem", label: "Montagem", amount: 13 }],
      energyAndGas: [{ id: "forno", label: "Forno e gás", amount: 5 }],
      fixedAllocation: [{ id: "fixos", label: "Custos fixos", amount: 10 }],
    });

    expect(snapshot.total).toBe(78);
    expect(snapshot.costPerUnit).toBe(6);
    expect(snapshot.breakdown.direct).toBe(44);
    expect(snapshot.recipeVersionId).toBe("receita-v7");
    expect(snapshot.dataStatus).toBe("validated");
  });

  it("forma preço por canal preservando margem mínima após taxas", () => {
    const result = calculateChannelPrice({
      totalCost: 90,
      targetMargin: 0.5,
      minimumMargin: 0.4,
      percentageCharges: 0.1,
      fixedCharges: 2,
      commercialRounding: 0.5,
    });

    expect(result.suggestedPrice).toBe(202.5);
    expect(result.minimumPrice).toBe(169);
    expect(result.expectedNetRevenue).toBe(180.25);
    expect(result.expectedProfit).toBe(90.25);
    expect(result.expectedMargin).toBeCloseTo(0.5007, 4);
  });

  it("rejeita perda integral, margem impossível e rendimento zero", () => {
    expect(() =>
      componentCost({
        id: "fruta",
        label: "Fruta",
        quantity: 1,
        unitCost: 1,
        lossPercent: 100,
      }),
    ).toThrow("menor que 100%");

    expect(() =>
      calculateChannelPrice({ totalCost: 10, targetMargin: 1 }),
    ).toThrow("menor que 100%");

    expect(() =>
      calculateCostSnapshot({
        recipeVersionId: "x",
        dataStatus: "provisional",
        yieldUnits: 0,
      }),
    ).toThrow("Rendimento");
  });
});
