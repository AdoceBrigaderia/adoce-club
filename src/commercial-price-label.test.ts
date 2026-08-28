import { describe, expect, it } from "vitest";
import { commercialProductPriceLabel } from "./commercial";

describe("rotulo de preco do catalogo comercial", () => {
  it.each([
    ["torta-p", 115, "A partir de R$\u00a0115,00"],
    ["torta-m", 155, "A partir de R$\u00a0155,00"],
    ["torta-g", 195, "A partir de R$\u00a0195,00"],
  ])("identifica %s como preco inicial", (slug, price, expected) => {
    expect(commercialProductPriceLabel({ slug, base_price: price, price_suffix: "" }))
      .toBe(expected);
  });

  it("preserva o valor comum dos demais produtos", () => {
    expect(commercialProductPriceLabel({ slug: "docinhos-tradicionais", base_price: 35, price_suffix: "" }))
      .toBe("R$\u00a035,00");
  });
});
