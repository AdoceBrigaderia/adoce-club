import { describe, expect, it } from "vitest";
import { grossLineTotal, moneyFromTypedDigits, normalizePurchaseQuantity, referenceQuantityInBase } from "./purchase-invoice";

describe("quantidade para custo de uma nota de compra", () => {
  it.each([
    [[{ name: "caixa", quantity: "10" }, { name: "unidade", quantity: "27" }], "395", "g", "g", 106650],
    [[{ name: "caixa", quantity: "5" }, { name: "unidade", quantity: "12" }], "1", "kg", "g", 60000],
    [[{ name: "caixa", quantity: "7" }, { name: "bag", quantity: "2" }], "5", "kg", "g", 70000],
    [[{ name: "saca", quantity: "1" }], "25", "kg", "g", 25000],
    [[{ name: "pacote", quantity: "1" }], "100", "unit", "unit", 100],
  ] as const)("normaliza embalagens aninhadas", (layers, content, unit, base, expected) => {
    expect(normalizePurchaseQuantity([...layers], content, unit, base)).toBe(expected);
  });
  it("rejeita conversão de dimensões incompatíveis", () => {
    expect(normalizePurchaseQuantity([{ name: "caixa", quantity: "1" }], "25", "kg", "ml")).toBeNull();
  });
  it("não completa quantidade ausente por suposição", () => {
    expect(normalizePurchaseQuantity([{ name: "caixa", quantity: "" }], "395", "g", "g")).toBeNull();
  });
  it("desloca centavos enquanto digita e multiplica pelo número de embalagens externas", () => {
    expect(moneyFromTypedDigits("8923")).toBe("89.23");
    expect(moneyFromTypedDigits("R$ 89,23")).toBe("89.23");
    expect(grossLineTotal("10", "89.23")).toBe("892.30");
  });
  it("compara o preço com uma embalagem de referência sem mudar a unidade de custo", () => {
    const referenceGrams = referenceQuantityInBase("395", "g", "g");
    expect(referenceGrams).toBe(395);
    expect((892.30 / 50000) * referenceGrams!).toBeCloseTo(7.04917, 5);
    expect(referenceQuantityInBase("1", "kg", "g")).toBe(1000);
    expect(referenceQuantityInBase("200", "g", "ml")).toBeNull();
  });
});
