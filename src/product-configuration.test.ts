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
    expect(quote.estimatedPrice).toBe(192);
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

  it("usa o preço e o limite de sabores do pacote exato", () => {
    const packaged = {
      ...product,
      minimum_quantity: 25,
      configuration_rules: {
        ...product.configuration_rules,
        minimumTotalQuantity: 25,
        maximumTotalQuantity: 100,
        minimumQuantityPerFlavor: 1,
        priceTiers: [
          { quantity: 25, price: 35, maximumFlavors: 1 },
          { quantity: 100, price: 140, maximumFlavors: 4 },
        ],
      },
    };

    expect(quoteProductConfiguration(packaged, 25, {
      "10000000-0000-4000-8000-000000000001": 25,
    }).estimatedPrice).toBe(35);
    expect(() => quoteProductConfiguration(packaged, 50, {})).toThrow(/pacotes disponíveis/);
    expect(() => quoteProductConfiguration(packaged, 25, {
      "10000000-0000-4000-8000-000000000001": 15,
      "10000000-0000-4000-8000-000000000002": 10,
    })).toThrow(/no máximo 1 sabor/);
  });

  it("exige o mínimo configurado para um grupo", () => {
    const schoolKit = {
      ...product,
      product_type: "school_kit" as const,
      minimum_quantity: 15,
      configuration_rules: {
        minimumTotalQuantity: 15,
        maximumTotalQuantity: 100,
        requireExactTotal: false,
        groupLimits: { adicionais: 1 },
        groupMinimums: { adicionais: 1 },
      },
    };
    expect(() => quoteProductConfiguration(schoolKit, 15, {})).toThrow(/pelo menos 1 opção/);
  });

  it("calcula adicionais do kit escolar sem confundir com a quantidade de crianças", () => {
    const schoolKit: ConfigurableCommercialProduct = {
      ...product,
      id: "20000000-0000-4000-8000-000000000001",
      slug: "escola-recreio-completo",
      segment: "school",
      name: "Recreio completo",
      base_price: 120,
      minimum_quantity: 15,
      product_type: "school_kit",
      configuration_rules: {
        minimumTotalQuantity: 15,
        maximumTotalQuantity: 100,
        requireExactTotal: false,
        allowAddons: true,
        includedQuantity: 15,
        additionalUnitPrice: 8,
        groupLimits: { sucos: 2 },
        groupMinimums: { sucos: 2 },
      },
      options: [
        {
          ...product.options[2],
          id: "20000000-0000-4000-8000-000000000011",
          product_id: "20000000-0000-4000-8000-000000000001",
          group_key: "sucos",
          option_code: "suco-uva",
          option_kind: "variant",
          label: "Suco de uva",
          price_adjustment: 0,
          unit_cost: 0,
        },
        {
          ...product.options[2],
          id: "20000000-0000-4000-8000-000000000012",
          product_id: "20000000-0000-4000-8000-000000000001",
          group_key: "sucos",
          option_code: "suco-maracuja",
          option_kind: "variant",
          label: "Suco de maracujá",
          price_adjustment: 0,
          unit_cost: 0,
        },
        {
          ...product.options[2],
          id: "20000000-0000-4000-8000-000000000013",
          product_id: "20000000-0000-4000-8000-000000000001",
          group_key: "adicionais",
          option_code: "docinhos-extras",
          option_kind: "addon",
          label: "Porção de docinhos extras",
          price_adjustment: 10,
          unit_cost: 4,
          maximum_quantity: 5,
        },
      ],
    };

    const quote = quoteProductConfiguration(schoolKit, 20, {
      "20000000-0000-4000-8000-000000000011": 1,
      "20000000-0000-4000-8000-000000000012": 1,
      "20000000-0000-4000-8000-000000000013": 2,
    });

    expect(quote.configuredQuantity).toBe(0);
    expect(quote.basePrice).toBe(160);
    expect(quote.priceAdjustment).toBe(20);
    expect(quote.estimatedPrice).toBe(180);
    expect(quote.internalCost).toBe(8);
    expect(quote.summary).toEqual(["1× Suco de uva", "1× Suco de maracujá", "2× Porção de docinhos extras"]);
  });

  it("rejeita adicionais quando o tipo de produto os desabilita", () => {
    const withoutAddons = {
      ...product,
      configuration_rules: { ...product.configuration_rules, allowAddons: false },
    };
    expect(() => quoteProductConfiguration(withoutAddons, 100, {
      "10000000-0000-4000-8000-000000000001": 60,
      "10000000-0000-4000-8000-000000000002": 40,
      "10000000-0000-4000-8000-000000000003": 1,
    })).toThrow(/não aceita adicionais/);
  });

  it("rejeita quantidade do pedido acima do máximo", () => {
    const limited = { ...product, configuration_rules: { ...product.configuration_rules, maximumTotalQuantity: 100 } };
    expect(() => quoteProductConfiguration(limited, 101, {})).toThrow(/quantidade máxima é 100/);
  });

  it("não inventa montagem para produto fixo", () => {
    const fixed = { ...product, product_type: "fixed" as const, customization_mode: "none" as const };
    expect(quoteProductConfiguration(fixed, 100, {})).toMatchObject({ items: [], priceAdjustment: 0 });
  });
});
