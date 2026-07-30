export type CakeBuilderPlacement =
  | "cake_layer"
  | "filling_layer"
  | "topping"
  | "filling_fruit"
  | "topping_fruit"
  | "filling_extra"
  | "topping_extra";

export type CakeBuilderOption = {
  id: string;
  placement: CakeBuilderPlacement;
  slug: string;
  label: string;
  description?: string;
  priceAdjustment: number;
  unitCost?: number;
  sortOrder?: number;
};

export type CakeBuilderTemplate = {
  id: string;
  productId: string;
  name: string;
  cakeLayers: number;
  fillingLayers: number;
  allowMixedCakeLayers: boolean;
  allowMixedFillings: boolean;
  options: CakeBuilderOption[];
};

export type CakeBuilderSelection = {
  cakeLayers: string[];
  fillingLayers: string[];
  topping: string | null;
  fillingFruits: string[];
  toppingFruits: string[];
  fillingExtras: string[];
  toppingExtras: string[];
};

export type CakeBuilderQuote = {
  templateId: string;
  selection: CakeBuilderSelection;
  estimatedPrice: number;
  estimatedInternalCost: number;
  summary: string[];
};

const placements = new Set<CakeBuilderPlacement>([
  "cake_layer",
  "filling_layer",
  "topping",
  "filling_fruit",
  "topping_fruit",
  "filling_extra",
  "topping_extra",
]);

const finiteMoney = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0;
};

const positiveInteger = (value: unknown, fallback: number, maximum = 12) => {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.min(maximum, parsed)
    : fallback;
};

export function normalizeCakeBuilderTemplate(value: unknown): CakeBuilderTemplate | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const rawOptions = Array.isArray(source.options) ? source.options : [];
  const options = rawOptions.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const option = item as Record<string, unknown>;
    const placement = String(option.placement || "") as CakeBuilderPlacement;
    if (!placements.has(placement)) return [];
    const id = String(option.id || "").trim();
    const label = String(option.label || "").trim();
    if (!id || !label) return [];
    return [
      {
        id,
        placement,
        slug: String(option.slug || id).trim(),
        label,
        description: String(option.description || "").trim() || undefined,
        priceAdjustment: finiteMoney(
          option.priceAdjustment ?? option.price_adjustment,
        ),
        unitCost: finiteMoney(option.unitCost ?? option.unit_cost),
        sortOrder: positiveInteger(option.sortOrder ?? option.sort_order, index, 10_000),
      } satisfies CakeBuilderOption,
    ];
  });

  const id = String(source.id || "").trim();
  const productId = String(source.productId ?? source.product_id ?? "").trim();
  if (!id || !productId || !options.length) return null;

  return {
    id,
    productId,
    name: String(source.name || "Montagem personalizada").trim(),
    cakeLayers: Math.max(
      1,
      positiveInteger(source.cakeLayers ?? source.cake_layers, 3, 8),
    ),
    fillingLayers: positiveInteger(
      source.fillingLayers ?? source.filling_layers,
      2,
      7,
    ),
    allowMixedCakeLayers: Boolean(
      source.allowMixedCakeLayers ?? source.allow_mixed_cake_layers ?? true,
    ),
    allowMixedFillings: Boolean(
      source.allowMixedFillings ?? source.allow_mixed_fillings ?? true,
    ),
    options: options.sort(
      (left, right) =>
        (left.sortOrder || 0) - (right.sortOrder || 0) ||
        left.label.localeCompare(right.label, "pt-BR"),
    ),
  };
}

export function optionsForPlacement(
  template: CakeBuilderTemplate,
  placement: CakeBuilderPlacement,
) {
  return template.options.filter((option) => option.placement === placement);
}

const defaultOptionId = (
  template: CakeBuilderTemplate,
  placement: CakeBuilderPlacement,
) => optionsForPlacement(template, placement)[0]?.id || "";

export function createCakeBuilderSelection(
  template: CakeBuilderTemplate,
): CakeBuilderSelection {
  const cake = defaultOptionId(template, "cake_layer");
  const filling = defaultOptionId(template, "filling_layer");
  const topping = defaultOptionId(template, "topping");
  return {
    cakeLayers: Array.from({ length: template.cakeLayers }, () => cake),
    fillingLayers: Array.from({ length: template.fillingLayers }, () => filling),
    topping: topping || null,
    fillingFruits: [],
    toppingFruits: [],
    fillingExtras: [],
    toppingExtras: [],
  };
}

function optionMap(template: CakeBuilderTemplate) {
  return new Map(template.options.map((option) => [option.id, option]));
}

function validOptionIds(
  template: CakeBuilderTemplate,
  placement: CakeBuilderPlacement,
) {
  return new Set(optionsForPlacement(template, placement).map((option) => option.id));
}

function normalizeLayerSelections(
  input: unknown,
  count: number,
  allowed: Set<string>,
  fallback: string,
) {
  const source = Array.isArray(input) ? input : [];
  return Array.from({ length: count }, (_, index) => {
    const candidate = String(source[index] || "");
    return allowed.has(candidate) ? candidate : fallback;
  });
}

function normalizeMultiSelections(input: unknown, allowed: Set<string>) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map(String).filter((id) => allowed.has(id)))].slice(0, 20);
}

export function normalizeCakeBuilderSelection(
  template: CakeBuilderTemplate,
  value: Partial<CakeBuilderSelection> | null | undefined,
): CakeBuilderSelection {
  const defaults = createCakeBuilderSelection(template);
  const cakeIds = validOptionIds(template, "cake_layer");
  const fillingIds = validOptionIds(template, "filling_layer");
  const toppingIds = validOptionIds(template, "topping");

  const cakeLayers = normalizeLayerSelections(
    value?.cakeLayers,
    template.cakeLayers,
    cakeIds,
    defaults.cakeLayers[0] || "",
  );
  const fillingLayers = normalizeLayerSelections(
    value?.fillingLayers,
    template.fillingLayers,
    fillingIds,
    defaults.fillingLayers[0] || "",
  );
  const requestedTopping = value?.topping ? String(value.topping) : "";

  return {
    cakeLayers: template.allowMixedCakeLayers
      ? cakeLayers
      : cakeLayers.map(() => cakeLayers[0] || ""),
    fillingLayers: template.allowMixedFillings
      ? fillingLayers
      : fillingLayers.map(() => fillingLayers[0] || ""),
    topping: toppingIds.has(requestedTopping)
      ? requestedTopping
      : defaults.topping,
    fillingFruits: normalizeMultiSelections(
      value?.fillingFruits,
      validOptionIds(template, "filling_fruit"),
    ),
    toppingFruits: normalizeMultiSelections(
      value?.toppingFruits,
      validOptionIds(template, "topping_fruit"),
    ),
    fillingExtras: normalizeMultiSelections(
      value?.fillingExtras,
      validOptionIds(template, "filling_extra"),
    ),
    toppingExtras: normalizeMultiSelections(
      value?.toppingExtras,
      validOptionIds(template, "topping_extra"),
    ),
  };
}

const allSelectedIds = (selection: CakeBuilderSelection) => [
  ...selection.cakeLayers,
  ...selection.fillingLayers,
  ...(selection.topping ? [selection.topping] : []),
  ...selection.fillingFruits,
  ...selection.toppingFruits,
  ...selection.fillingExtras,
  ...selection.toppingExtras,
];

export function calculateCakeBuilderPrice(
  template: CakeBuilderTemplate,
  selection: CakeBuilderSelection,
  basePrice: number,
) {
  const options = optionMap(template);
  return Math.round(
    allSelectedIds(selection).reduce(
      (total, id) => total + (options.get(id)?.priceAdjustment || 0),
      finiteMoney(basePrice),
    ) * 100,
  ) / 100;
}

export function calculateCakeBuilderInternalCost(
  template: CakeBuilderTemplate,
  selection: CakeBuilderSelection,
) {
  const options = optionMap(template);
  return Math.round(
    allSelectedIds(selection).reduce(
      (total, id) => total + (options.get(id)?.unitCost || 0),
      0,
    ) * 100,
  ) / 100;
}

export function validateCakeBuilderSelection(
  template: CakeBuilderTemplate,
  selection: CakeBuilderSelection,
) {
  const errors: string[] = [];
  const expectedCake = template.cakeLayers;
  const expectedFilling = template.fillingLayers;
  if (selection.cakeLayers.length !== expectedCake)
    errors.push(`Escolha as ${expectedCake} camadas de bolo.`);
  if (selection.fillingLayers.length !== expectedFilling)
    errors.push(`Escolha as ${expectedFilling} camadas de recheio.`);
  if (!selection.topping) errors.push("Escolha a cobertura.");

  const allowedByPlacement = new Map<CakeBuilderPlacement, Set<string>>(
    ([
      "cake_layer",
      "filling_layer",
      "topping",
      "filling_fruit",
      "topping_fruit",
      "filling_extra",
      "topping_extra",
    ] as CakeBuilderPlacement[]).map((placement) => [
      placement,
      validOptionIds(template, placement),
    ]),
  );

  const ensureAllowed = (
    ids: string[],
    placement: CakeBuilderPlacement,
    message: string,
  ) => {
    const allowed = allowedByPlacement.get(placement)!;
    if (ids.some((id) => !allowed.has(id))) errors.push(message);
  };

  ensureAllowed(selection.cakeLayers, "cake_layer", "Há uma massa indisponível.");
  ensureAllowed(
    selection.fillingLayers,
    "filling_layer",
    "Há um recheio indisponível.",
  );
  ensureAllowed(
    selection.topping ? [selection.topping] : [],
    "topping",
    "A cobertura escolhida está indisponível.",
  );
  ensureAllowed(
    selection.fillingFruits,
    "filling_fruit",
    "Há uma fruta de recheio indisponível.",
  );
  ensureAllowed(
    selection.toppingFruits,
    "topping_fruit",
    "Há uma fruta de cobertura indisponível.",
  );
  ensureAllowed(
    selection.fillingExtras,
    "filling_extra",
    "Há um adicional de recheio indisponível.",
  );
  ensureAllowed(
    selection.toppingExtras,
    "topping_extra",
    "Há um adicional de cobertura indisponível.",
  );

  if (
    !template.allowMixedCakeLayers &&
    new Set(selection.cakeLayers).size > 1
  )
    errors.push("Esta torta usa o mesmo sabor em todas as camadas de bolo.");
  if (
    !template.allowMixedFillings &&
    new Set(selection.fillingLayers).size > 1
  )
    errors.push("Esta torta usa o mesmo sabor em todas as camadas de recheio.");

  return [...new Set(errors)];
}

function labelsForIds(
  template: CakeBuilderTemplate,
  ids: string[],
) {
  const options = optionMap(template);
  return ids.map((id) => options.get(id)?.label || "Opção indisponível");
}

export function cakeBuilderSummary(
  template: CakeBuilderTemplate,
  selection: CakeBuilderSelection,
) {
  const options = optionMap(template);
  const lines = [
    `Camadas de bolo: ${labelsForIds(template, selection.cakeLayers).join(" · ")}`,
    `Camadas de recheio: ${labelsForIds(template, selection.fillingLayers).join(" · ") || "sem recheio"}`,
    `Cobertura: ${selection.topping ? options.get(selection.topping)?.label || "não informada" : "não informada"}`,
  ];
  const optionalLines: Array<[string, string[]]> = [
    ["Frutas no recheio", selection.fillingFruits],
    ["Frutas na cobertura", selection.toppingFruits],
    ["Adicionais no recheio", selection.fillingExtras],
    ["Adicionais na cobertura", selection.toppingExtras],
  ];
  optionalLines.forEach(([label, ids]) => {
    if (ids.length) lines.push(`${label}: ${labelsForIds(template, ids).join(" · ")}`);
  });
  return lines;
}

export function buildCakeBuilderQuote(
  template: CakeBuilderTemplate,
  selection: CakeBuilderSelection,
  basePrice: number,
): CakeBuilderQuote {
  const normalized = normalizeCakeBuilderSelection(template, selection);
  return {
    templateId: template.id,
    selection: normalized,
    estimatedPrice: calculateCakeBuilderPrice(template, normalized, basePrice),
    estimatedInternalCost: calculateCakeBuilderInternalCost(template, normalized),
    summary: cakeBuilderSummary(template, normalized),
  };
}

export function fallbackCakeBuilderTemplate(
  productId: string,
  productName = "Torta personalizada",
): CakeBuilderTemplate {
  const option = (
    id: string,
    placement: CakeBuilderPlacement,
    label: string,
    priceAdjustment: number,
    unitCost: number,
  ): CakeBuilderOption => ({
    id,
    placement,
    slug: id,
    label,
    priceAdjustment,
    unitCost,
  });

  return {
    id: `visual-${productId || "cake"}`,
    productId: productId || "visual-cake",
    name: `Montagem de ${productName}`,
    cakeLayers: 3,
    fillingLayers: 2,
    allowMixedCakeLayers: true,
    allowMixedFillings: true,
    options: [
      option("massa-chocolate", "cake_layer", "Massa de chocolate", 0, 7),
      option("massa-baunilha", "cake_layer", "Massa branca", 0, 6.5),
      option("massa-red-velvet", "cake_layer", "Red Velvet", 5, 9),
      option("recheio-brigadeiro", "filling_layer", "Brigadeiro de chocolate", 0, 8),
      option("recheio-ninho", "filling_layer", "Brigadeiro de Ninho", 3, 9.5),
      option("recheio-meio-amargo", "filling_layer", "Chocolate meio amargo", 4, 10),
      option("recheio-maracuja", "filling_layer", "Maracujá", 3, 8.5),
      option("cobertura-chocolate", "topping", "Brigadeiro de chocolate", 0, 6),
      option("cobertura-ninho", "topping", "Brigadeiro de Ninho", 3, 7.5),
      option("cobertura-meio-amargo", "topping", "Chocolate meio amargo", 4, 8),
      option("fruta-morango-recheio", "filling_fruit", "Morangos no recheio", 12, 8),
      option("fruta-uva-recheio", "filling_fruit", "Uvas no recheio", 10, 7),
      option("fruta-morango-topo", "topping_fruit", "Morangos na cobertura", 10, 7),
      option("fruta-vermelha-topo", "topping_fruit", "Frutas vermelhas", 14, 9),
      option("extra-chocolate-recheio", "filling_extra", "Pedaços de chocolate", 8, 5),
      option("extra-crocante-recheio", "filling_extra", "Crocante", 7, 4),
      option("extra-brigadeiros-topo", "topping_extra", "Brigadeiros no topo", 10, 6),
      option("extra-chocolate-topo", "topping_extra", "Pedaços de chocolate no topo", 8, 5),
    ],
  };
}
