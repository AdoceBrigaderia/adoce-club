import { Customer } from "./domain";

const makeCustomer = (balance: number, suffix: string): Customer => ({
  id: crypto.randomUUID(), name: "Rubens", phone: `11999990${suffix}`, email: "rubens@exemplo.local",
  balance, token: `adoce_${crypto.randomUUID().replaceAll("-", "")}`, status: "ACTIVE", marketingConsent: false, transactions: []
});

const initial = [makeCustomer(0,"00"), makeCustomer(8,"08"), makeCustomer(13,"13"), makeCustomer(14,"14")];
const KEY = "adoce-fidelidade-v1";

export const loadCustomers = (): Customer[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "null") || initial; } catch { return initial; }
};
export const saveCustomers = (customers: Customer[]) => localStorage.setItem(KEY, JSON.stringify(customers));
