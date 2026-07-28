import { describe, expect, it } from "vitest";
import {
  productConfigurationPayload,
  quoteProductConfiguration,
  type ConfigurableCommercialProduct,
} from "./product-configuration";

const product: ConfigurableCommercialProduct = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "cento-docinhos",
  segment: "sweets",
  name: "Cento de docinhos",
  short_description: "Monte os sabores",
  base_price: 160,
  minimum_quantity: 100,
  lead_business_days: 3,
  product_type: "sweet",
  customization_mode: "option_groups",
  configuration_rules: {
    minimumTotalQuantity: 100,
    maximumTotalQuantity: 100,
    maximumFlavors: 5,
    minimumQuantityPerFlavor: 10,
    requireExactTotal: true,
    allowAddons: true,
  },
  image_url: null,
  published: true,
  active: true,
  options: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      product_id: "00000000-0000-4000-8000-000000000001",
      group_key: "sabores",
      option_code: "brigadeiro",
      option_kind: "flavor",
      label: "Brigadeiro",
      price_adjustment: 0,
      unit_cost: 0.8,
      minimum_quantity: 10,
      maximum_quantity: 100,
      active: true,
      published: true,
      sort_order: 1,
    },
    {
      id: "10000000-0000-4000-8000-000000000002",
      product_id: "00000000-0000-4000-8000-000000000001",
      group_key: "sabores",
      option_code: "ferrero",
      option_kind: "flavor",
      label: "Ferrero",
      price_adjustment: 0.5,
      unit_cost: 1.2,
      minimum_quantity: 10,
      maximum_quantity: 100,
      active: true,
      published: true,
      sort_order: 2,
    },
    {
      id: "10000000-0000-4000-8000-000000000003",
      product_id: "00000000-0000-4000-8000-000000000001",
      group_key: "adicionais",
      option_code: "embalagem-premium",
      option_kind: "addon",
      label: "Embalagem premium",
      price_adjustment: 12,
      unit_cost: 4,
      minimum_quantity: 1,
      maximum_quantity: 1,
      active: true,
      published: true,
      sort_order: 3,
    },
  ],
};

describe("configuração estruturada de produtos", () => {
  it("preserva sabores, quantidades, custo e preço adicional", () => {
    const quote = quoteProductConfiguration(product, 100, {
      "10000000-0000-4000-8000-000000000001": 60,
      "10000000-0000-4000-8000-000000000002": 40,
      "10000000-0000-4000-8000-000000000003": 1,
    });

    expect(quote.configuredQuantity).toBe(100);
    expect(quote.selectedFlavorCount).toBe(2);
    expect(quote.internalCost).toBe(100);
    expect(quote.priceAdjustment).toBe(32);
    expect(quote.summary).toEqual(["60× Brigadeiro", "40× Ferrero", "1× Embalagem premium"]);
    expect(productConfigurationPayload(quote)).toEqual({
      schema_version: 1,
      items: [
        { option_id: "10000000-0000-4000-8000-000000000001", quantity: 60 },
        { option_id: "10000000-0000-4000-8000-000000000002", quantity: 40 },
        { option_id: "10000000-0000-4000-8000-000000000003", quantity: 1 },
      ],
    });
  });

  it("rejeita pedido cujo total de sabores não coincide com a quantidade", () => {
    expect(() =>
      quoteProductConfiguration(product, 100, {
        "10000000-0000-4000-8000-000000000001": 50,
        "10000000-0000-4000-8000-000000000002": 40,
      }),
    ).toThrow(/exatamente 100/);
  });

  it("rejeita mais sabores do que o produto permite", () => {
    const expanded = {
      ...product,
      configuration_rules: { ...product.configuration_rules, maximumFlavors: 1 },
    };
    expect(() =>
      quoteProductConfiguration(expanded, 100, {
        "10000000-0000-4000-8000-000000000001": 50,
        "10000000-0000-4000-8000-000000000002": 50,
      }),
    ).toThrow(/no máximo 1 sabor/);
  });

  it("não inventa montagem para produto fixo", () => {
    const fixed = { ...product, product_type: "fixed" as const, customization_mode: "none" as const };
    expect(quoteProductConfiguration(fixed, 100, {})).toMatchObject({ items: [], priceAdjustment: 0 });
  });
});
