import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tabletList = readFileSync(new URL("./TabletShoppingList.tsx", import.meta.url), "utf8");

describe("checkbox da lista de compras no tablet", () => {
  it("respeita a marcação explícita mesmo quando a compra registrada é parcial", () => {
    expect(tabletList).not.toContain('if(value&&completion.state==="partial")');
    expect(tabletList).toContain('onChange("procurement",id,{...current,purchased:value})');
    expect(tabletList).toContain('onChange("inCart",id,value)');
  });
});
