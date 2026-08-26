import { useEffect, useState } from "react";
import { isSupabaseConfigured, requireSupabase } from "./lib/supabase";

export const fallbackOrderWhatsApp = "5585982156026";

export type WhatsAppOrderItem = {
  name: string;
  sauce: string;
};

export type WhatsAppOrderMessageInput = {
  orderNumber: string;
  customerName: string;
  items: WhatsAppOrderItem[];
  total: number;
  pickupTime: string;
  pickupMethod: "customer" | "driver";
  location?: string;
};

export function normalizeOrderWhatsApp(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function orderWhatsAppUrl(number: string, message: string) {
  return `https://wa.me/${normalizeOrderWhatsApp(number) || fallbackOrderWhatsApp}?text=${encodeURIComponent(message)}`;
}

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function displayOrderNumber(value: string) {
  const normalized = value.trim().replace(/^#/, "");
  return `#${normalized.startsWith("ADOCE-") ? normalized : `ADOCE-${normalized}`}`;
}

function displayPickupTime(value: string) {
  const [hour, minute] = value.split(":");
  if (!hour) return value;
  return minute && minute !== "00" ? `${hour}h${minute}` : `${hour}h`;
}

export function buildOrderWhatsAppMessage({
  orderNumber,
  customerName,
  items,
  total,
  pickupTime,
  pickupMethod,
  location = "Cantinho Adoce",
}: WhatsAppOrderMessageInput) {
  const products = items.flatMap((item) => [
    `- 01 ${item.name}`,
    `- Calda: ${item.sauce || "Sem calda"}`,
    "",
  ]);
  const quantity = String(items.length).padStart(2, "0");

  return [
    "Olá, Adoce! Quero fazer uma reserva.",
    "",
    `Pedido: ${displayOrderNumber(orderNumber)}`,
    `Cliente: ${customerName.trim()}`,
    "Produtos:",
    ...products,
    `Total: ${quantity} ${items.length === 1 ? "fatia" : "fatias"}`,
    `Valor: ${money(total)}`,
    "",
    `Retirada: hoje às ${displayPickupTime(pickupTime)}`,
    `Local: ${location}`,
    `Retirada por: ${pickupMethod === "driver" ? "entregador de aplicativo" : "cliente"}`,
  ].join("\n").trim();
}

export function useOrderWhatsAppNumber() {
  const [number, setNumber] = useState(fallbackOrderWhatsApp);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void requireSupabase().rpc("get_public_order_whatsapp_number").then(({ data, error }) => {
      if (!error && typeof data === "string" && normalizeOrderWhatsApp(data)) setNumber(normalizeOrderWhatsApp(data));
    });
  }, []);
  return number;
}
