export type ProductType = "cake" | "sweet" | "cookie" | "school_kit" | "fixed";
export type ProductCustomizationMode = "none" | "cake_builder" | "option_groups";
export type ProductOptionKind = "flavor" | "variant" | "format" | "theme" | "packaging" | "addon";

export type ProductPriceTier = {
  quantity: number;
  price: number;
  maximumFlavors?: number;
};

export type ProductConfigurationRules = {
  minimumTotalQuantity?: number;
  maximumTotalQuantity?: number;
  maximumFlavors?: number;
  minimumQuantityPerFlavor?: number;
  requireExactTotal?: boolean;
  allowAddons?: boolean;
  priceTiers?: ProductPriceTier[];
  includedQuantity?: number;
  additionalUnitPrice?: number;
  groupLimits?: Record<string, number>;
  groupMinimums?: Record<string, number>;
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
  basePrice: number;
  priceAdjustment: number;
  estimatedPrice: number;
  internalCost: number;
};

export type NormalizedProductConfigurationRules = {
  minimumTotalQuantity: number;
  maximumTotalQuantity: number;
  maximumFlavors: number;
  minimumQuantityPerFlavor: number;
  requireExactTotal: boolean;
  allowAddons: boolean;
  priceTiers: ProductPriceTier[];
  includedQuantity: number;
  additionalUnitPrice: number;
  groupLimits: Record<string, number>;
  groupMinimums: Record<string, number>;
};

const positiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const nonNegativeNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const normalizeGroupRules = (input: Record<string, number> | null | undefined) =>
  Object.fromEntries(
    Object.entries(input || {})
      .map(([group, limit]) => [group.trim(), positiveInteger(limit, 0)] as const)
      .filter(([group, limit]) => Boolean(group) && limit > 0),
  );

export function normalizeProductConfigurationRules(
  input: ProductConfigurationRules | null | undefined,
): NormalizedProductConfigurationRules {
  const priceTiers = Array.isArray(input?.priceTiers)
    ? input.priceTiers
        .map((tier) => ({
          quantity: positiveInteger(tier?.quantity, 0),
          price: nonNegativeNumber(tier?.price, -1),
          maximumFlavors: tier?.maximumFlavors
            ? positiveInteger(tier.maximumFlavors, 1)
            : undefined,
        }))
        .filter((tier) => tier.quantity > 0 && tier.price >= 0)
        .sort((left, right) => left.quantity - right.quantity)
    : [];

  return {
    minimumTotalQuantity: positiveInteger(input?.minimumTotalQuantity, 1),
    maximumTotalQuantity: positiveInteger(input?.maximumTotalQuantity, 10000),
    maximumFlavors: positiveInteger(input?.maximumFlavors, 100),
    minimumQuantityPerFlavor: positiveInteger(input?.minimumQuantityPerFlavor, 1),
    requireExactTotal: input?.requireExactTotal === true,
    allowAddons: input?.allowAddons !== false,
    priceTiers,
    includedQuantity: positiveInteger(input?.includedQuantity, 1),
    additionalUnitPrice: nonNegativeNumber(input?.additionalUnitPrice, 0),
    groupLimits: normalizeGroupRules(input?.groupLimits),
    groupMinimums: normalizeGroupRules(input?.groupMinimums),
  };
}

function resolveBasePrice(
  product: ConfigurableCommercialProduct,
  requestedQuantity: number,
  rules: NormalizedProductConfigurationRules,
) {
  if (rules.priceTiers.length) {
    const tier = rules.priceTiers.find((item) => item.quantity === requestedQuantity);
    if (!tier) {
      throw new Error(
        `Escolha um dos pacotes disponíveis: ${rules.priceTiers.map((item) => item.quantity).join(", ")} unidade(s).`,
      );
    }
    return { basePrice: tier.price, maximumFlavors: tier.maximumFlavors || rules.maximumFlavors };
  }
  const includedQuantity = Math.max(product.minimum_quantity, rules.includedQuantity);
  const additionalUnits = Math.max(0, requestedQuantity - includedQuantity);
  return {
    basePrice: nonNegativeNumber(product.base_price, 0) + additionalUnits * rules.additionalUnitPrice,
    maximumFlavors: rules.maximumFlavors,
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

  const rules = normalizeProductConfigurationRules(product.configuration_rules);
  const minimumQuantity = Math.max(product.minimum_quantity, rules.minimumTotalQuantity);
  if (requestedQuantity < minimumQuantity) {
    throw new Error(`A quantidade mínima é ${minimumQuantity}.`);
  }
  if (requestedQuantity > rules.maximumTotalQuantity) {
    throw new Error(`A quantidade máxima é ${rules.maximumTotalQuantity}.`);
  }

  const pricing = resolveBasePrice(product, requestedQuantity, rules);

  if (product.customization_mode !== "option_groups") {
    return {
      items: [],
      summary: [],
      selectedFlavorCount: 0,
      configuredQuantity: 0,
      basePrice: pricing.basePrice,
      priceAdjustment: 0,
      estimatedPrice: pricing.basePrice,
      internalCost: 0,
    };
  }

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

  if (flavorItems.length > pricing.maximumFlavors) {
    throw new Error(`Escolha no máximo ${pricing.maximumFlavors} sabor(es).`);
  }
  for (const item of flavorItems) {
    if (item.quantity < rules.minimumQuantityPerFlavor) {
      throw new Error(`Cada sabor precisa ter pelo menos ${rules.minimumQuantityPerFlavor} unidade(s).`);
    }
  }
  for (const [group, limit] of Object.entries(rules.groupLimits)) {
    const selected = items.filter((item) => item.groupKey === group).length;
    if (selected > limit) throw new Error(`Escolha no máximo ${limit} opção(ões) em ${group.replace(/_/g, " ")}.`);
  }
  for (const [group, minimum] of Object.entries(rules.groupMinimums)) {
    const selected = items.filter((item) => item.groupKey === group).length;
    if (selected < minimum) throw new Error(`Escolha pelo menos ${minimum} opção(ões) em ${group.replace(/_/g, " ")}.`);
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

  const priceAdjustment = items.reduce((sum, item) => sum + item.priceAdjustment, 0);
  return {
    items,
    summary: items.map((item) => `${item.quantity}× ${item.label}`),
    selectedFlavorCount: flavorItems.length,
    configuredQuantity,
    basePrice: pricing.basePrice,
    priceAdjustment,
    estimatedPrice: pricing.basePrice + priceAdjustment,
    internalCost: items.reduce((sum, item) => sum + item.internalCost, 0),
  };
}

export function productConfigurationPayload(quote: ProductConfigurationQuote) {
  return {
    schema_version: 1,
    items: quote.items.map((item) => ({ option_id: item.optionId, quantity: item.quantity })),
  };
}
