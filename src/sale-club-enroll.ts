import { requireSupabase } from "./lib/supabase";

// Cadastro opcional no Clube no fechamento da venda (nome, sobrenome e WhatsApp).
export type SaleEnrollResult = {
  existing: boolean;
  fullName: string;
  stampsAdded: number;
  progress: number;
  newRewards: number;
  welcomeSent: boolean;
  stampsMessageSent: boolean;
  temporaryPassword?: string;
  warnings: string[];
};

export const enrollFieldsError = (name: string, phone: string) => {
  const hasName = name.trim().length > 0;
  const digits = phone.replace(/\D/g, "");
  if (!hasName && !digits) return "";
  if (name.trim().split(/\s+/).filter((part) => part.length > 1).length < 2) return "Para cadastrar no Clube, informe nome e sobrenome do cliente.";
  if (digits.length < 10 || digits.length > 13) return "Para cadastrar no Clube, informe o WhatsApp com DDD.";
  return "";
};

export const wantsEnroll = (name: string, phone: string) => name.trim().length > 0 || phone.replace(/\D/g, "").length > 0;

export function enrollSummary(result: SaleEnrollResult) {
  const first = result.fullName.split(/\s+/)[0] || "Cliente";
  const stamps = result.stampsAdded === 1 ? "1 carimbo" : `${result.stampsAdded} carimbos`;
  const parts = [result.existing ? `${first} já era do Clube.` : `${first} cadastrado(a) no Clube.`];
  if (result.stampsAdded > 0) parts.push(`${stamps} lançado(s)${result.newRewards ? ` e ${result.newRewards} fatia(s) grátis liberada(s)` : ""}.`);
  if (!result.existing && result.welcomeSent) parts.push("Boas-vindas com o link para criar a senha enviadas pelo WhatsApp.");
  if (result.temporaryPassword) parts.push(`WhatsApp indisponível: informe ao cliente a senha temporária ${result.temporaryPassword} para entrar em adocebrigaderia.com.br/clube.`);
  parts.push(...result.warnings);
  return parts.join(" ");
}

export async function enrollSaleCustomer(orderId: string, fullName: string, phone: string): Promise<SaleEnrollResult> {
  const { data } = await requireSupabase().auth.getSession();
  if (!data.session) throw new Error("Entre novamente na operação.");
  const response = await fetch("/api/staff-enroll-sale-customer", {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, fullName, phone }),
  });
  const payload = (await response.json().catch(() => ({}))) as SaleEnrollResult & { error?: string };
  if (!response.ok || payload.error) throw new Error(payload.error || "Não foi possível cadastrar o cliente no Clube.");
  return payload;
}
