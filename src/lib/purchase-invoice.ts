export type BaseUnit = "g" | "kg" | "ml" | "l" | "unit";
export type PackageLayer = { name: string; quantity: string };

export function referenceQuantityInBase(quantity: string | number | null, unit: BaseUnit | null, baseUnit: BaseUnit): number | null {
  if (quantity == null || unit == null) return null;
  const value = Number(quantity);
  if (!Number.isFinite(value) || value <= 0) return null;
  const multiplier = unit === baseUnit ? 1
    : unit === "kg" && baseUnit === "g" ? 1000
    : unit === "g" && baseUnit === "kg" ? 0.001
    : unit === "l" && baseUnit === "ml" ? 1000
    : unit === "ml" && baseUnit === "l" ? 0.001
    : null;
  return multiplier == null ? null : value * multiplier;
}

export function moneyFromTypedDigits(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  const cents = BigInt(digits);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

export function moneyCents(value: string): bigint | null {
  if (!/^\d+\.\d{2}$/.test(value)) return null;
  const [whole, fraction] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction);
}

export function grossLineTotal(outerQuantity: string, unitPrice: string): string | null {
  const count = Number(outerQuantity);
  const cents = moneyCents(unitPrice);
  if (!Number.isSafeInteger(count) || count <= 0 || cents == null) return null;
  const total = cents * BigInt(count);
  return `${total / 100n}.${String(total % 100n).padStart(2, "0")}`;
}

const factor: Record<BaseUnit, { dimension: string; toSmallest: number }> = {
  g: { dimension: "mass", toSmallest: 1 },
  kg: { dimension: "mass", toSmallest: 1000 },
  ml: { dimension: "volume", toSmallest: 1 },
  l: { dimension: "volume", toSmallest: 1000 },
  unit: { dimension: "count", toSmallest: 1 },
};

export function normalizePurchaseQuantity(
  layers: PackageLayer[], contentQuantity: string, contentUnit: BaseUnit, baseUnit: BaseUnit,
): number | null {
  if (!layers.length || layers.length > 5 || factor[contentUnit].dimension !== factor[baseUnit].dimension) return null;
  const content = Number(contentQuantity);
  if (!Number.isFinite(content) || content <= 0) return null;
  let total = content * factor[contentUnit].toSmallest / factor[baseUnit].toSmallest;
  for (const layer of layers) {
    const quantity = Number(layer.quantity);
    if (!layer.name.trim() || !Number.isInteger(quantity) || quantity <= 0) return null;
    total *= quantity;
  }
  if (!Number.isFinite(total) || total <= 0 || total > 9_999_999_999) return null;
  return Math.round(total * 1_000_000) / 1_000_000;
}
