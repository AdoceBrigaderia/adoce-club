import { describe, expect, it } from "vitest";
import { cakeSections, selectedComponentQuantity, packagingQuantity, suggestedSlicePackaging, slicePackagingSection, suggestedSliceFinishing, sliceFinishingSection } from "./cost-sheet";
import { CostEngine, money } from "./cost-engine";

describe("montagem de tortas", () => {
  it("carrega o rendimento real e deixa o consumo do insumo para o usuário informar", () => {
    expect(selectedComponentQuantity("recipe_version", { yield_quantity: 650, yield_unit: "g" })).toEqual({ quantity: "650", unit: "g" });
    expect(selectedComponentQuantity("recipe_version", { yield_quantity: 700, yield_unit: "g" })).toEqual({ quantity: "700", unit: "g" });
    expect(selectedComponentQuantity("item", { consumption_unit: "ml" })).toEqual({ quantity: "", unit: "ml" });
    expect(selectedComponentQuantity("recipe_version", { yield_quantity: null, yield_unit: null }).quantity).toBe("");
    expect(cakeSections.map(s => s.count)).toEqual([3, 2, 0, 0, 0, 0]);
    expect(packagingQuantity("1", 13, "save")).toBe("13");
    expect(packagingQuantity(13, 13, "edit")).toBe("1");
    expect(packagingQuantity("0.5", 13, "save")).toBe("6.5");
    expect(packagingQuantity("1", 20, "save")).toBe("20");
    expect(() => packagingQuantity("1", 0, "save")).toThrow();
    const workspace = { recipes: [{ id: "source", name: "Abacaxi com Coco", active: true }], versions: [{ id: "old", recipe_id: "source", version_number: 1, size_code: "G", yield_quantity: 13, yield_unit: "slice" }, { id: "new", recipe_id: "source", version_number: 2, size_code: "G", yield_quantity: 13, yield_unit: "slice" }], components: [{ recipe_version_id: "old", placement: slicePackagingSection, component_kind: "item", item_id: "old-box", quantity: 26, unit: "unit", sort_order: 0 }, { recipe_version_id: "new", placement: slicePackagingSection, component_kind: "item", item_id: "box", quantity: 13, unit: "unit", sort_order: 0 }] };
    expect(suggestedSlicePackaging(workspace)).toEqual([{ kind: "item", id: "box", quantity: "1", unit: "unit", placement: slicePackagingSection }]);
    expect(suggestedSlicePackaging({ ...workspace, recipes: [] })).toEqual([]);
    expect(suggestedSliceFinishing({ recipes: [{id:"calda",name:"CALDA",active:true}], versions: [{id:"calda-v",recipe_id:"calda",version_number:5,size_code:null,yield_quantity:22,yield_unit:"unit"}] })).toEqual([{kind:"recipe_version",id:"calda-v",quantity:"1",unit:"unit",placement:sliceFinishingSection}]);
    const caldaEngine = new CostEngine(new Map([["base", {id:"base",name:"Base",purchasePrice:"22",purchased:{value:"100",unit:"g"}}]]),new Map([["calda",{id:"calda",name:"Calda",yield:{value:"22",unit:"unit"},components:[{kind:"ingredient",id:"base",quantity:{value:"100",unit:"g"}}]}]]));
    const caldaCost = caldaEngine.cake({size:"G",sections:[{name:sliceFinishingSection,components:[{kind:"preparation",id:"calda",quantity:{value:packagingQuantity("1",13,"save"),unit:"unit"}}]}]},13);
    expect(caldaCost.status).toBe("CALCULADA");
    if(caldaCost.status === "CALCULADA") { expect(money(caldaCost.micros)).toBe("13.00"); expect(money(caldaCost.sliceMicros!)).toBe("1.00"); }
  });
  it("soma três discos, dois recheios, mistura e cobertura proporcional", () => {
    const engine = new CostEngine(new Map([["base", { id: "base", name: "Base", purchasePrice: "10", purchased: { value: "1000", unit: "g" } }]]), new Map([
      ["disco", { id: "disco", name: "Disco", yield: { value: "650", unit: "g" }, components: [{ kind: "ingredient", id: "base", quantity: { value: "500", unit: "g" } }] }],
      ["recheio", { id: "recheio", name: "Recheio", yield: { value: "700", unit: "g" }, components: [{ kind: "ingredient", id: "base", quantity: { value: "1000", unit: "g" } }] }],
    ]));
    const result = engine.cake({ size: "G", sections: [{ name: "Torta", components: [
      ...Array.from({ length: 3 }, () => ({ kind: "preparation" as const, id: "disco", quantity: { value: "650", unit: "g" as const } })),
      ...Array.from({ length: 2 }, () => ({ kind: "preparation" as const, id: "recheio", quantity: { value: "700", unit: "g" as const } })),
      { kind: "ingredient", id: "base", quantity: { value: "100", unit: "g" } },
      { kind: "preparation", id: "recheio", quantity: { value: "350", unit: "g" } },
    ] }] });
    expect(result.status).toBe("CALCULADA");
    if (result.status === "CALCULADA") expect(money(result.micros)).toBe("41.00");
  });
});
