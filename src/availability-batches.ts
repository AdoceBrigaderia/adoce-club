export type AvailabilityBatch = {
  id: string;
  flavor_id: string;
  available_from: string;
  quantity_available: number;
  quantity_reserved?: number;
  quantity_free?: number;
};

export const normalizeTime = (value: string) => value.slice(0, 5);

export const currentLocalTime = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return `${hour === "24" ? "00" : hour}:${minute}`;
};

export const batchFree = (batch: AvailabilityBatch) =>
  Math.max(
    0,
    batch.quantity_free ??
      batch.quantity_available - (batch.quantity_reserved || 0),
  );

export const totalBatchFree = (batches: AvailabilityBatch[]) =>
  batches.reduce((total, batch) => total + batchFree(batch), 0);

export function batchAvailabilityLines(
  batches: AvailabilityBatch[],
  nowTime = currentLocalTime(),
) {
  const now = normalizeTime(nowTime);
  const grouped = new Map<string, number>();
  for (const batch of batches) {
    const free = batchFree(batch);
    if (!free) continue;
    const time = normalizeTime(batch.available_from);
    const key = time <= now ? "now" : time;
    grouped.set(key, (grouped.get(key) || 0) + free);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => {
      if (left === "now") return -1;
      if (right === "now") return 1;
      return left.localeCompare(right);
    })
    .map(([time, quantity]) => ({ time, quantity }));
}

export function earliestPickupTimeForQuantity(
  batches: AvailabilityBatch[],
  quantity: number,
  nowTime = currentLocalTime(),
) {
  if (quantity <= 0) return undefined;
  const now = normalizeTime(nowTime);
  let cumulative = 0;
  const ordered = [...batches].sort((left, right) =>
    normalizeTime(left.available_from).localeCompare(normalizeTime(right.available_from)),
  );
  for (const batch of ordered) {
    cumulative += batchFree(batch);
    if (cumulative >= quantity) {
      const release = normalizeTime(batch.available_from);
      return release <= now ? now : release;
    }
  }
  return undefined;
}

export function latestRequiredPickupTime(
  selections: Array<{ batches: AvailabilityBatch[]; quantity: number }>,
  regularMinimum?: string,
  nowTime = currentLocalTime(),
) {
  const requirements = selections
    .map(({ batches, quantity }) =>
      earliestPickupTimeForQuantity(batches, quantity, nowTime),
    )
    .filter((time): time is string => Boolean(time));
  return [regularMinimum, ...requirements]
    .filter((time): time is string => Boolean(time))
    .map(normalizeTime)
    .sort()
    .at(-1);
}

export const formatBatchAvailability = (
  batches: AvailabilityBatch[],
  nowTime = currentLocalTime(),
) =>
  batchAvailabilityLines(batches, nowTime).map(({ time, quantity }) =>
    time === "now"
      ? `${quantity} ${quantity === 1 ? "fatia disponível agora" : "fatias disponíveis agora"}`
      : `${quantity} ${quantity === 1 ? "fatia a partir" : "fatias a partir"} das ${time.replace(":00", "h")}`,
  );
