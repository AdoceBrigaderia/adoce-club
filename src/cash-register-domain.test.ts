import { describe, expect, it } from "vitest";
import { addLine, applyDiscount, calculateTotals, recordPayment, removeLine } from "./cash-register-domain";
const flavor = { id: "f1", shortName: "Ninho", unitPrice: 16 };
describe("cash register domain", () => {
  it("adds one unit per tap and keeps sauce optional", () => { const twice = addLine(addLine([], flavor), flavor); expect(twice[0]).toMatchObject({ flavorId: "f1", quantity: 2, sauce: null }); });
  it("removes quantities", () => { const lines = addLine(addLine([], flavor), flavor); expect(removeLine(lines, "f1")[0].quantity).toBe(1); expect(removeLine(removeLine(lines, "f1"), "f1")).toEqual([]); });
  it("supports dupla as two stock units", () => { const lines = addLine([], { ...flavor, id: "dupla", shortName: "Dupla Ninho", unitPrice: 25, stockUnits: 2 }); expect(lines[0]).toMatchObject({ quantity: 1, stockUnits: 2, unitPrice: 25 }); });
  it("calculates discounts", () => { const lines = addLine([], flavor); expect(applyDiscount(calculateTotals(lines, { kind: "none", value: 0 }).subtotal, { kind: "amount", value: 3 })).toBe(13); expect(applyDiscount(16, { kind: "percent", value: 25 })).toBe(12); });
  it("keeps partial payments and remaining balance", () => { const lines = addLine(addLine([], flavor), flavor); const paid = recordPayment([], { method: "cash", amount: 10 }); expect(calculateTotals(lines, { kind: "none", value: 0 }, paid).remaining).toBe(22); expect(calculateTotals(lines, { kind: "none", value: 0 }, recordPayment(paid, { method: "pix", amount: 22 })).remaining).toBe(0); });
});
