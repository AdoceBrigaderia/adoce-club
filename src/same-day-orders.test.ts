import { describe, expect, it } from "vitest";
import { sameDayOrderGroups } from "./OperationInstantOrders";
import { fortalezaDay, readKnownOrders, rememberOrder } from "./same-day-orders";

const memory = () => { const data: Record<string, string> = {}; return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } }; };

describe("pedido repetido no mesmo dia", () => {
  it("agrupa pedidos do mesmo celular no mesmo dia e ignora cancelados", () => {
    const groups = sameDayOrderGroups([
      { id: "a", order_number: "FAT-1", customer_phone: "+5585999990000", status: "reserved", created_at: "2026-10-31T13:00:00Z" },
      { id: "b", order_number: "FAT-2", customer_phone: "+5585999990000", status: "awaiting_confirmation", created_at: "2026-10-31T14:00:00Z" },
      { id: "c", order_number: "FAT-3", customer_phone: "+5585999990000", status: "cancelled", created_at: "2026-10-31T15:00:00Z" },
      { id: "d", order_number: "FAT-4", customer_phone: "+5585911110000", status: "reserved", created_at: "2026-10-31T15:00:00Z" },
      { id: "e", order_number: "FAT-5", customer_phone: "+5585999990000", status: "reserved", created_at: "2026-10-30T15:00:00Z" },
    ]);
    expect(groups.get("b")).toEqual({ position: 2, others: ["FAT-1"] });
    expect(groups.get("a")).toEqual({ position: 1, others: ["FAT-2"] });
    expect(groups.has("c") || groups.has("d") || groups.has("e")).toBe(false);
  });

  it("guarda só os pedidos de hoje deste aparelho", () => {
    const storage = memory();
    storage.setItem("adoce-orders-today", JSON.stringify([{ order_number: "FAT-0", token: "t", day: "2020-01-01" }]));
    rememberOrder("FAT-9", "tok", storage);
    expect(readKnownOrders(storage)).toEqual([{ order_number: "FAT-9", token: "tok", day: fortalezaDay() }]);
  });
});
