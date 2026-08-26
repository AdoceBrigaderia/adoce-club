import { estaPronta, imprimir } from "./conexao-bluetooth";

export type ThermalOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_notes?: string | null;
  pickup_requested_time?: string | null;
  pickup_method?: "customer" | "driver" | null;
  pickup_label?: string | null;
  total: number;
  created_at: string;
  instant_order_items: Array<{
    id: string;
    flavor_name: string;
    quantity: number;
    instant_order_item_sauces?: Array<{ unit_number: number; sauce_name: string }>;
  }>;
};

declare global {
  interface Window {
    AdocePrinter?: { printEscPos: (payload: string) => Promise<void> | void };
  }
}

const money = (value: number) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const key = (id: string) => `adoce-thermal-printed:${id}`;

export function buildThermalReceipt(order: ThermalOrder) {
  const lines = [
    "[LOGO ADOCE]",
    "ADOCE BRIGADERIA",
    `PEDIDO ${order.order_number}`,
    "--------------------------------",
    order.customer_name,
    order.customer_phone,
    order.pickup_requested_time
      ? `Retirada ${order.pickup_requested_time.slice(0, 5)} · ${order.pickup_method === "driver" ? "entregador" : "cliente"}`
      : "Retirada: confirmar",
    ...(order.customer_notes ? [order.customer_notes] : []),
    "--------------------------------",
  ];
  let quantity = 0;
  order.instant_order_items.forEach((item) => {
    Array.from({ length: item.quantity }, (_, index) => index + 1).forEach((unit) => {
      quantity += 1;
      const sauces = (item.instant_order_item_sauces || [])
        .filter((choice) => choice.unit_number === unit)
        .map((choice) => choice.sauce_name)
        .join(" e ") || "Sem calda";
      lines.push(`[ ] ${item.flavor_name}`, `    Calda: ${sauces}`, "");
    });
  });
  lines.push(
    `TOTAL: ${String(quantity).padStart(2, "0")} FATIA(S)`,
    `VALOR: ${money(order.total)}`,
    "--------------------------------",
    "[ ] Sabores   [ ] Caldas",
    "[ ] Embalado  [ ] Identificado",
    "[ ] Pronto",
    "--------------------------------",
    "Preparado com carinho para",
    "adocar o seu dia. Obrigado por",
    "escolher a Adoce! <3",
  );
  return lines.join("\n");
}

export function hasNativeThermalPrinter() {
  return typeof window !== "undefined" && Boolean(window.AdocePrinter?.printEscPos);
}

export async function printThermalOrder(order: ThermalOrder, force = false) {
  if (!force && localStorage.getItem(key(order.id))) return "already_printed" as const;
  if (estaPronta()) {
    await imprimir({
      numero: order.order_number,
      cliente: order.customer_name,
      telefone: order.customer_phone,
      itens: order.instant_order_items.map((item) => ({
        sabor: item.flavor_name,
        quantidade: item.quantity,
        calda: (item.instant_order_item_sauces || []).map((choice) => choice.sauce_name).join(" e ") || null,
        presente: Boolean((item as typeof item & { is_reward?: boolean }).is_reward),
      })),
      total: Number(order.total),
      retirada: order.pickup_requested_time
        ? `${order.pickup_label || "Cantinho da Adoce"} · ${order.pickup_requested_time.slice(0, 5)}`
        : null,
      observacao: order.customer_notes || null,
      criadoEm: order.created_at,
    });
    localStorage.setItem(key(order.id), new Date().toISOString());
    localStorage.removeItem(`adoce-thermal-pending:${order.id}`);
    return "printed" as const;
  }
  if (!hasNativeThermalPrinter()) {
    localStorage.setItem(`adoce-thermal-pending:${order.id}`, order.order_number);
    return "queued_for_android" as const;
  }
  await window.AdocePrinter!.printEscPos(buildThermalReceipt(order));
  localStorage.setItem(key(order.id), new Date().toISOString());
  localStorage.removeItem(`adoce-thermal-pending:${order.id}`);
  return "printed" as const;
}
