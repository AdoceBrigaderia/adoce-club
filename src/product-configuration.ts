export type ProductType = "cake" | "sweet" | "cookie" | "school_kit" | "fixed";
export type ProductCustomizationMode = "none" | "cake_builder" | "option_groups";
export type ProductOptionKind = "flavor" | "variant" | "format" | "theme" | "packaging" | "addon";

export type ProductConfigurationRules = {
  minimumTotalQuantity?: number;
  maximumTotalQuantity?: number;
  maximumFlavors?: number;
  minimumQuantityPerFlavor?: number;
  requireExactTotal?: boolean;
  allowAddons?: boolean;
};

export type ProductConfigurationOption = {
  id: string;
  product_id: string;
  group_key: string;
  option_code: string;
  option_kind: ProductOptionKind;
  label: string;
  price_adjustment: number;
  unit_cost: number;
  minimum_quantity: number;
  maximum_quantity: number | null;
  active: boolean;
  published: boolean;
  sort_order: number;
};

export type ConfigurableCommercialProduct = {
  id: string;
  slug: string;
  segment: string;
  name: string;
  short_description: string;
  base_price: number | null;
  minimum_quantity: number;
  lead_business_days: number;
  product_type: ProductType;
  customization_mode: ProductCustomizationMode;
  configuration_rules: ProductConfigurationRules;
  image_url: string | null;
  published: boolean;
  active: boolean;
  options: ProductConfigurationOption[];
};

export type ProductConfigurationDraft = Record<string, number>;

export type ProductConfigurationQuote = {
  items: Array<{
    optionId: string;
    optionCode: string;
    optionKind: ProductOptionKind;
    groupKey: string;
    label: string;
    quantity: number;
    priceAdjustment: number;
    internalCost: number;
  }>;
  summary: string[];
  selectedFlavorCount: number;
  configuredQuantity: number;
  priceAdjustment: number;
  internalCost: number;
};

const positiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export function normalizeProductConfigurationRules(
  input: ProductConfigurationRules | null | undefined,
): Required<ProductConfigurationRules> {
  return {
    minimumTotalQuantity: positiveInteger(input?.minimumTotalQuantity, 1),
    maximumTotalQuantity: positiveInteger(input?.maximumTotalQuantity, 10000),
    maximumFlavors: positiveInteger(input?.maximumFlavors, 100),
    minimumQuantityPerFlavor: positiveInteger(input?.minimumQuantityPerFlavor, 1),
    requireExactTotal: input?.requireExactTotal === true,
    allowAddons: input?.allowAddons !== false,
  };
}

export function quoteProductConfiguration(
  product: ConfigurableCommercialProduct,
  requestedQuantity: number,
  draft: ProductConfigurationDraft,
): ProductConfigurationQuote {
  if (!Number.isInteger(requestedQuantity) || requestedQuantity < product.minimum_quantity) {
    throw new Error(`A quantidade mínima é ${product.minimum_quantity}.`);
  }

  if (product.customization_mode !== "option_groups") {
    return {
      items: [],
      summary: [],
      selectedFlavorCount: 0,
      configuredQuantity: 0,
      priceAdjustment: 0,
      internalCost: 0,
    };
  }

  const rules = normalizeProductConfigurationRules(product.configuration_rules);
  const items = product.options
    .filter((option) => option.active && option.published)
    .map((option) => ({ option, quantity: Number(draft[option.id] || 0) }))
    .filter(({ quantity }) => quantity > 0)
    .map(({ option, quantity }) => {
      if (!Number.isInteger(quantity)) throw new Error(`A quantidade de ${option.label} deve ser inteira.`);
      if (quantity < option.minimum_quantity) {
        throw new Error(`${option.label} exige pelo menos ${option.minimum_quantity} unidade(s).`);
      }
      if (option.maximum_quantity !== null && quantity > option.maximum_quantity) {
        throw new Error(`${option.label} permite no máximo ${option.maximum_quantity} unidade(s).`);
      }
      if (option.option_kind === "addon" && !rules.allowAddons) {
        throw new Error("Este produto não aceita adicionais.");
      }
      return {
        optionId: option.id,
        optionCode: option.option_code,
        optionKind: option.option_kind,
        groupKey: option.group_key,
        label: option.label,
        quantity,
        priceAdjustment: Number(option.price_adjustment || 0) * quantity,
        internalCost: Number(option.unit_cost || 0) * quantity,
      };
    });

  const flavorItems = items.filter((item) => item.optionKind === "flavor");
  const configuredQuantity = flavorItems.reduce((sum, item) => sum + item.quantity, 0);

  if (flavorItems.length > rules.maximumFlavors) {
    throw new Error(`Escolha no máximo ${rules.maximumFlavors} sabor(es).`);
  }
  for (const item of flavorItems) {
    if (item.quantity < rules.minimumQuantityPerFlavor) {
      throw new Error(`Cada sabor precisa ter pelo menos ${rules.minimumQuantityPerFlavor} unidade(s).`);
    }
  }
  if (rules.requireExactTotal && configuredQuantity !== requestedQuantity) {
    throw new Error(`Distribua exatamente ${requestedQuantity} unidade(s) entre os sabores.`);
  }
  if (configuredQuantity > rules.maximumTotalQuantity) {
    throw new Error(`A configuração excede ${rules.maximumTotalQuantity} unidade(s).`);
  }
  if (product.product_type === "sweet" && configuredQuantity < rules.minimumTotalQuantity) {
    throw new Error(`Distribua pelo menos ${rules.minimumTotalQuantity} unidade(s) entre os sabores.`);
  }

  return {
    items,
    summary: items.map((item) => `${item.quantity}× ${item.label}`),
    selectedFlavorCount: flavorItems.length,
    configuredQuantity,
    priceAdjustment: items.reduce((sum, item) => sum + item.priceAdjustment, 0),
    internalCost: items.reduce((sum, item) => sum + item.internalCost, 0),
  };
}

export function productConfigurationPayload(quote: ProductConfigurationQuote) {
  return {
    schema_version: 1,
    items: quote.items.map((item) => ({ option_id: item.optionId, quantity: item.quantity })),
  };
}
