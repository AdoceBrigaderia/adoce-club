import { describe, it, expect } from "vitest";
import { weeklyPurchaseGroups, weeklyPurchaseTotals } from "./purchase-report";
import type { PlanItem } from "./purchase-planner";

const sugar: PlanItem = { id: "sugar", name: "Açúcar", internal_code: "INS1", item_kind: "ingredient", consumption_unit: "g", active: true, reference_quantity: 1000, reference_unit: "g", reference_package_name: "pacote" };
const butter: PlanItem = { id: "butter", name: "Manteiga", internal_code: "INS2", item_kind: "ingredient", consumption_unit: "g", active: true, reference_quantity: null, reference_unit: null, reference_package_name: null };

describe("relatório de compras por semana", () => {
  it("agrupa a quantidade e o valor comprados pela semana da nota, convertendo a unidade", () => {
    const invoices = [
      { issued_on: "2026-10-05", created_at: "2026-10-05", lines: [
        { item_id: "sugar", brand_name: "", package_layers: [{ name: "caixa", quantity: "2" }], normalized_quantity: 10, normalized_unit: "kg", outer_unit_price: 100, gross_total: 200, net_total: 180 },
      ] },
      { issued_on: "2026-10-07", created_at: "2026-10-07", lines: [
        { item_id: "sugar", brand_name: "", package_layers: [{ name: "caixa", quantity: "1" }], normalized_quantity: 5, normalized_unit: "kg", outer_unit_price: 90, gross_total: 90, net_total: 90 },
      ] },
      { issued_on: "2026-10-13", created_at: "2026-10-13", lines: [
        { item_id: "sugar", brand_name: "", package_layers: [{ name: "caixa", quantity: "1" }], normalized_quantity: 5, normalized_unit: "kg", outer_unit_price: 90, gross_total: 90, net_total: 90 },
      ] },
    ];
    const totals = weeklyPurchaseTotals(invoices, [sugar]);
    expect(totals).toContainEqual({ itemId: "sugar", week: "2026-10-05", quantity: 15000, total: 270 });
    expect(totals).toContainEqual({ itemId: "sugar", week: "2026-10-12", quantity: 5000, total: 90 });
  });
  it("ignora linhas de item excluído do cadastro ou com unidade incompatível", () => {
    const invoices = [{ issued_on: "2026-10-05", created_at: "2026-10-05", lines: [
      { item_id: "ghost", brand_name: "", package_layers: [], normalized_quantity: 1, normalized_unit: "kg", outer_unit_price: null, gross_total: 10, net_total: 10 },
      { item_id: "sugar", brand_name: "", package_layers: [], normalized_quantity: 1, normalized_unit: "unit", outer_unit_price: null, gross_total: 10, net_total: 10 },
    ] }];
    expect(weeklyPurchaseTotals(invoices, [sugar])).toEqual([]);
  });
  it("monta grupos por semana, mais recente primeiro, com itens ordenados e total gasto", () => {
    const invoices = [
      { issued_on: "2026-10-05", created_at: "2026-10-05", lines: [
        { item_id: "sugar", brand_name: "", package_layers: [], normalized_quantity: 1, normalized_unit: "kg", outer_unit_price: null, gross_total: 10, net_total: 10 },
        { item_id: "butter", brand_name: "", package_layers: [], normalized_quantity: 500, normalized_unit: "g", outer_unit_price: null, gross_total: 15, net_total: 15 },
      ] },
      { issued_on: "2026-10-13", created_at: "2026-10-13", lines: [
        { item_id: "sugar", brand_name: "", package_layers: [], normalized_quantity: 1, normalized_unit: "kg", outer_unit_price: null, gross_total: 12, net_total: 12 },
      ] },
    ];
    const groups = weeklyPurchaseGroups(invoices, [sugar, butter]);
    expect(groups.map(g => g.week)).toEqual(["2026-10-12", "2026-10-05"]);
    expect(groups[1].total).toBe(25);
    expect(groups[1].rows.map(r => r.item.name)).toEqual(["Açúcar", "Manteiga"]);
  });
});
