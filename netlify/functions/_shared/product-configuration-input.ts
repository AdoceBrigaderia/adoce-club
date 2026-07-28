const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonObject = Record<string, unknown>;

export type SanitizedProductConfiguration = {
  schema_version: 1;
  items: Array<{ option_id: string; quantity: number }>;
};

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function sanitizeProductConfiguration(
  value: unknown,
): SanitizedProductConfiguration | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return null;

  const source = value as JsonObject;
  if (Number(source.schema_version) !== 1) return null;
  if (!Array.isArray(source.items) || source.items.length > 100) return null;

  const seen = new Set<string>();
  const items: SanitizedProductConfiguration["items"] = [];

  for (const rawItem of source.items) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) return null;
    const item = rawItem as JsonObject;
    const optionId = text(item.option_id, 36);
    const quantity = Number(item.quantity);

    if (!UUID.test(optionId)) return null;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) return null;
    if (seen.has(optionId)) return null;

    seen.add(optionId);
    items.push({ option_id: optionId, quantity });
  }

  return { schema_version: 1, items };
}
