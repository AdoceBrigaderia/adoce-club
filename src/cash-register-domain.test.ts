import { describe, expect, it } from "vitest";
import { addLine, applyDiscount, calculateTotals, recordPayment, removeLine } from "./cash-register-domain";

const flavor = { id: "f1", shortName: "Ninho", unitPrice: 16 };

describe("cash register domain", () => {
  it("adds one unit per tap and keeps sauce optional", () => {
    const once = addLine([], flavor, undefined);
    const twice = addLine(once, flavor, undefined);
    expect(twice[0]).toMatchObject({ flavorId: "f1", quantity: 2, sauce: null });
  });

  it("removes a quantity without leaving negative lines", () => {
    const lines = addLine(addLine([], flavor), flavor);
    expect(removeLine(lines, "f1")[0].quantity).toBe(1);
    expect(removeLine(removeLine(lines, "f1"), "f1")).toEqual([]);
  });

  it("supports dupla as two stock units with a custom total", () => {
    const lines = addLine([], { ...flavor, id: "dupla-f1", shortName: "Dupla Ninho", unitPrice: 25, stockUnits: 2 });
    expect(lines[0]).toMatchObject({ quantity: 1, stockUnits: 2, unitPrice: 25 });
    expect(calculateTotals(lines, { kind: "none", value: 0 })).toMatchObject({ subtotal: 25, total: 25 });
  });

  it("calculates amount and percentage discounts", () => {
    const lines = addLine([], flavor);
    expect(applyDiscount(calculateTotals(lines, { kind: "none", value: 0 }).subtotal, { kind: "amount", value: 3 })).toBe(13);
    expect(applyDiscount(calculateTotals(lines, { kind: "none", value: 0 }).subtotal, { kind: "percent", value: 25 })).toBe(12);
  });

  it("keeps partial payments and reports remaining balance", () => {
    const lines = addLine(addLine([], flavor), flavor);
    const totals = calculateTotals(lines, { kind: "none", value: 0 });
    const paid = recordPayment([], { method: "cash", amount: 10 });
    expect(calculateTotals(lines, { kind: "none", value: 0 }, paid).remaining).toBe(22);
    const complete = recordPayment(paid, { method: "pix", amount: 22 });
    expect(calculateTotals(lines, { kind: "none", value: 0 }, complete).remaining).toBe(0);
    expect(totals.total).toBe(32);
  });
});
