import type { Ingredient, Unit } from "./cost-engine";

type PurchaseReference = { id: string; name: string; active: boolean; data_status: string; price: null | { purchase_price: number; purchased_quantity: number; purchase_unit: string; useful_quantity: number | null; data_status: string } };
export function ingredientFromPurchase(item: PurchaseReference): Ingredient {
  const price = item.price;
  const usable = price && item.data_status !== "blocked" && price.data_status !== "blocked";
  const supported = ["g", "kg", "ml", "l", "unit"].includes(price?.purchase_unit || "");
  return {
    id: item.id, name: item.name, active: item.active,
    purchasePrice: usable ? String(price.purchase_price) : undefined,
    purchased: usable && supported ? { value: String(price.purchased_quantity), unit: price.purchase_unit as Unit } : undefined,
    useful: usable && supported && price.useful_quantity != null ? { value: String(price.useful_quantity), unit: price.purchase_unit as Unit } : undefined,
  };
}
