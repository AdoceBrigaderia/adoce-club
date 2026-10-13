import type { Payment } from "./cash-register-domain";

export type CashPaymentMethod = "cash" | "pix" | "credit_card" | "debit_card" | "payroll";
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const parseCashAmount = (value: string) => Number(value.trim().replace(",", "."));
export function paymentBalance(total: number, payments: Payment[]) {
  const paid = round(payments.reduce((sum, payment) => sum + payment.amount, 0));
  return {paid, remaining:round(Math.max(0,total-paid)), change:round(Math.max(0,paid-total))};
}
export function singlePayment(total: number, method: CashPaymentMethod, received = String(total)): Payment[] {
  const amount = method === "cash" ? parseCashAmount(received) : total;
  if (!Number.isFinite(amount) || amount < total) throw Error("O valor recebido deve cobrir o total da venda.");
  return [{method,amount:round(amount)}];
}
export function addSplitPayment(total: number, payments: Payment[], method: CashPaymentMethod, value: string): Payment[] {
  const amount = round(parseCashAmount(value));
  const remaining = paymentBalance(total,payments).remaining;
  if (!value.trim() || !Number.isFinite(amount) || amount <= 0) throw Error("Digite o valor deste pagamento.");
  if (remaining <= 0) throw Error("O total já está coberto.");
  if (method !== "cash" && amount > remaining) throw Error("Esse valor supera o restante. Troco somente em dinheiro.");
  return [...payments,{method,amount}];
}
export function cashDayRange(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Fortaleza"}).format(now);
  const start = new Date(`${day}T00:00:00-03:00`);
  return {day,start:start.toISOString(),end:new Date(start.getTime()+86400000).toISOString()};
}
export type CashCheckoutRequest = {
  method: CashPaymentMethod;
  payments: Payment[];
  deferred?: boolean;
  loyalty?: boolean;
  loyaltyUnitKey?: string;
  loyaltyKind?: "manual" | "digital";
  customerProfileId?: string;
  customerRewardId?: string;
  name?: string;
  clubName?: string;
  clubPhone?: string;
  changePix?: number;
  changeSource?: string;
};
