// Pedidos feitos neste aparelho hoje. O token fica so aqui: e ele que prova
// ao banco que quem pergunta e o dono do pedido (ver
// supabase/migrations/20261031120000_same_day_order_guard.sql).
const STORAGE_KEY = "adoce-orders-today";

export type KnownOrder = { order_number: string; token: string; day: string };

export type SameDayOrder = {
  order_number: string;
  status: string;
  created_at: string;
  total: number;
  can_cancel: boolean;
  items: { name: string; quantity: number }[];
};

export type SameDayCheck = { has_orders: boolean; orders: SameDayOrder[] };

export function fortalezaDay(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
}

export function readKnownOrders(storage: Pick<Storage, "getItem"> = localStorage): KnownOrder[] {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
    const today = fortalezaDay();
    return Array.isArray(parsed)
      ? parsed.filter((order) => order && order.day === today && order.order_number && order.token)
      : [];
  } catch {
    return [];
  }
}

export function rememberOrder(order_number: string, token: string, storage: Pick<Storage, "getItem" | "setItem"> = localStorage) {
  try {
    const known = readKnownOrders(storage).filter((order) => order.order_number !== order_number);
    storage.setItem(STORAGE_KEY, JSON.stringify([...known, { order_number, token, day: fortalezaDay() }].slice(-10)));
  } catch {
    // Sem armazenamento, o aviso continua aparecendo, so sem os detalhes.
  }
}

export const sameDayStatusLabel: Record<string, string> = {
  awaiting_confirmation: "Aguardando a loja confirmar",
  reserved: "Confirmado e reservado",
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  preparing: "Em separação",
  ready: "Pronto para retirar",
  completed: "Entregue",
};
