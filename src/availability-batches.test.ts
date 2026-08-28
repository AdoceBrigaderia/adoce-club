import { describe, expect, it } from "vitest";
import {
  batchAvailabilityLines,
  earliestPickupTimeForQuantity,
  formatBatchAvailability,
  latestRequiredPickupTime,
  totalBatchFree,
  type AvailabilityBatch,
} from "./availability-batches";

const batch = (
  id: string,
  available_from: string,
  quantity_available: number,
  quantity_reserved = 0,
): AvailabilityBatch => ({
  id,
  flavor_id: "flavor",
  available_from,
  quantity_available,
  quantity_reserved,
});

describe("lotes de disponibilidade de fatias", () => {
  const batches = [
    batch("now", "08:00", 4, 1),
    batch("afternoon", "17:00", 8),
    batch("night", "20:00", 12, 2),
  ];

  it("separa estoque imediato dos próximos horários", () => {
    expect(batchAvailabilityLines(batches, "12:00")).toEqual([
      { time: "now", quantity: 3 },
      { time: "17:00", quantity: 8 },
      { time: "20:00", quantity: 10 },
    ]);
    expect(totalBatchFree(batches)).toBe(21);
  });

  it("calcula quando o pedido inteiro poderá ser retirado", () => {
    expect(earliestPickupTimeForQuantity(batches, 3, "12:00")).toBe("12:00");
    expect(earliestPickupTimeForQuantity(batches, 4, "12:00")).toBe("17:00");
    expect(earliestPickupTimeForQuantity(batches, 12, "12:00")).toBe("20:00");
    expect(earliestPickupTimeForQuantity(batches, 22, "12:00")).toBeUndefined();
  });

  it("usa o horário mais tardio quando o carrinho mistura sabores", () => {
    expect(latestRequiredPickupTime([
      { batches, quantity: 4 },
      { batches: [batch("other", "20:00", 2)], quantity: 1 },
    ], "09:00", "12:00")).toBe("20:00");
  });

  it("gera textos curtos para o cliente", () => {
    expect(formatBatchAvailability(batches, "12:00")).toEqual([
      "3 fatias disponíveis agora",
      "8 fatias a partir das 17h",
      "10 fatias a partir das 20h",
    ]);
  });
});
