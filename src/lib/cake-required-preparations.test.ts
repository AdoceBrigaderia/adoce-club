import { expect, it } from "vitest";
import { requiredCakePreparations } from "./cake-required-preparations";

const workspace = {
  recipes: [{ id: "d", name: "DESMOLDANTE FORMAS", active: true, recipe_kind: "intermediate" }, { id: "i", name: "IRRIGAÇÃO", active: true, recipe_kind: "intermediate" }],
  versions: [{ id: "d1", recipe_id: "d", version_number: 1, size_code: null, yield_unit: "g", yield_quantity: 900 }, { id: "i1", recipe_id: "i", version_number: 1, size_code: null, yield_unit: "ml", yield_quantity: 1400 }, { id: "i2", recipe_id: "i", version_number: 2, size_code: null, yield_unit: "ml", yield_quantity: 1400 }],
};
it("inclui o consumo por torta usando a versão mais recente, sem multiplicar por fatias", () => {
  expect(requiredCakePreparations(workspace).map(row => [row.id, row.quantity, row.unit])).toEqual([["d1", "40", "g"], ["i2", "300", "ml"]]);
});
it("não sugere preparação inativa ou com rendimento incompatível", () => {
  expect(() => requiredCakePreparations({ ...workspace, recipes: [] })).toThrow();
  expect(() => requiredCakePreparations({ ...workspace, versions: workspace.versions.map(v => ({ ...v, yield_unit: "unit" })) })).toThrow();
});
