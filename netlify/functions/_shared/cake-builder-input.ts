const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonObject = Record<string, unknown>;

export type SanitizedCakeBuilder = {
  cake_layers: string[];
  filling_layers: string[];
  topping: string;
  filling_fruits: string[];
  topping_fruits: string[];
  filling_extras: string[];
  topping_extras: string[];
};

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function uuidList(
  value: unknown,
  maximum: number,
  { distinct }: { distinct: boolean },
) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maximum) return null;
  const normalized = value.map((item) => text(item, 36));
  if (normalized.some((item) => !UUID.test(item))) return null;
  return distinct ? [...new Set(normalized)] : normalized;
}

export function sanitizeCakeBuilder(
  value: unknown,
): SanitizedCakeBuilder | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as JsonObject;

  // Camadas são listas ordenadas: repetir o mesmo UUID representa usar o mesmo
  // sabor em mais de uma camada e não pode ser deduplicado no BFF.
  const cakeLayers = uuidList(source.cake_layers, 8, { distinct: false });
  const fillingLayers = uuidList(source.filling_layers, 7, { distinct: false });

  // Frutas e adicionais são conjuntos sem repetição.
  const fillingFruits = uuidList(source.filling_fruits, 20, { distinct: true });
  const toppingFruits = uuidList(source.topping_fruits, 20, { distinct: true });
  const fillingExtras = uuidList(source.filling_extras, 20, { distinct: true });
  const toppingExtras = uuidList(source.topping_extras, 20, { distinct: true });
  const topping = text(source.topping, 36);

  if (
    cakeLayers === null ||
    fillingLayers === null ||
    fillingFruits === null ||
    toppingFruits === null ||
    fillingExtras === null ||
    toppingExtras === null ||
    !topping ||
    !UUID.test(topping)
  )
    return null;

  return {
    cake_layers: cakeLayers,
    filling_layers: fillingLayers,
    topping,
    filling_fruits: fillingFruits,
    topping_fruits: toppingFruits,
    filling_extras: fillingExtras,
    topping_extras: toppingExtras,
  };
}
