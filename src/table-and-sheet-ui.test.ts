import { describe, expect, it } from "vitest";
import {
  compactCostHeader,
  describeItemUsage,
  firstProblemRow,
  floatingTableIndex,
} from "./table-and-sheet-ui";

describe("comportamento reutilizável das tabelas", () => {
  it("mantém apenas a tabela que cruza o topo disponível com linhas ainda visíveis", () => {
    expect(floatingTableIndex([
      { headerTop: -120, tableBottom: 760, headerHeight: 42, visible: true },
      { headerTop: 810, tableBottom: 1300, headerHeight: 42, visible: true },
    ], 96)).toBe(0);
    expect(floatingTableIndex([
      { headerTop: -120, tableBottom: 130, headerHeight: 42, visible: true },
      { headerTop: 810, tableBottom: 1300, headerHeight: 42, visible: true },
    ], 96)).toBe(-1);
  });

  it("não cria cabeçalho flutuante para tabelas transformadas em cartões", () => {
    expect(floatingTableIndex([
      { headerTop: -80, tableBottom: 900, headerHeight: 0, visible: false },
    ], 72)).toBe(-1);
  });
});

describe("fichas por sabor", () => {
  it("encurta os títulos extensos sem retirar seu significado", () => {
    expect(compactCostHeader("Ingredientes da torta")).toBe("Ingredientes\nda torta");
    expect(compactCostHeader("Margem após custos e taxas")).toBe("Margem após\ncustos e taxas");
    expect(compactCostHeader("Preço de venda ideal")).toBe("Preço ideal\nde venda");
  });

  it("localiza primeiro o componente incompleto para receber foco", () => {
    expect(firstProblemRow([
      { id: "massa", quantity: "650" },
      { id: "oreo", quantity: "2" },
      { id: "", quantity: "" },
    ], ["Componente ausente"])).toBe(2);

    expect(firstProblemRow([
      { id: "massa", quantity: "650", label: "Massa de chocolate" },
      { id: "oreo", quantity: "2", label: "OREO" },
    ], ["OREO: preço ou quantidade de compra não cadastrados"])).toBe(1);
  });
});

describe("identificação de insumos homônimos", () => {
  it("explica quando outro cadastro parecido é o realmente usado na ficha", () => {
    expect(describeItemUsage(
      { id: "biscoito", name: "BISCOITO OREO", internalCode: "NF-OREO" },
      { used: false, cakes: [] },
      [{ item: { id: "oreo", name: "OREO", internalCode: "INS-OREO" }, usage: { used: true, cakes: ["Oreo"] } }],
    )).toBe("Sem uso neste cadastro. A ficha Oreo usa outro item: OREO · INS-OREO.");
  });
});
