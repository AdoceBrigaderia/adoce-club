import { expect, it } from "vitest";
import { CostEngine, money } from "./cost-engine";
import { ingredientFromPurchase } from "./cost-purchase-reference";

const item = { id: "creme", name: "Creme", active: true, data_status: "provisional", price: { purchase_price: 100, purchased_quantity: 10000, purchase_unit: "g", useful_quantity: null, data_status: "provisional" } };
it("usa o preço registrado na nota e a quantidade comprada antes da conferência", () => {
  const result = new CostEngine(new Map([[item.id, ingredientFromPurchase(item)]]), new Map()).ingredient(item.id, { value: "500", unit: "g" });
  expect(result.status).toBe("CALCULADA");
  if (result.status === "CALCULADA") expect(money(result.micros)).toBe("5.00");
});
it("recalcula automaticamente pela quantidade útil quando ela é informada", () => {
  const updated = { ...item, price: { ...item.price, useful_quantity: 8000 } };
  const result = new CostEngine(new Map([[item.id, ingredientFromPurchase(updated)]]), new Map()).ingredient(item.id, { value: "500", unit: "g" });
  expect(result.status).toBe("CALCULADA");
  if (result.status === "CALCULADA") expect(money(result.micros)).toBe("6.25");
});
it("mantém pendências reais e não utiliza um registro bloqueado", () => {
  expect(ingredientFromPurchase({ ...item, price: null }).purchasePrice).toBeUndefined();
  expect(ingredientFromPurchase({ ...item, price: { ...item.price, data_status: "blocked" } }).purchasePrice).toBeUndefined();
});
