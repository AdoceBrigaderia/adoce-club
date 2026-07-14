export const REWARD_THRESHOLD = 14;

export type TransactionType = "EARN" | "REDEEM" | "ADJUSTMENT_CREDIT" | "ADJUSTMENT_DEBIT" | "REVERSAL" | "MIGRATION";
export type LoyaltyTransaction = {
  id: string; type: TransactionType; pointsDelta: number; previousBalance: number;
  resultingBalance: number; createdAt: string; note?: string; orderReference?: string; idempotencyKey: string;
};

export type Customer = {
  id: string; name: string; phone: string; email?: string; balance: number; token: string;
  status: "ACTIVE" | "BLOCKED"; marketingConsent: boolean; transactions: LoyaltyTransaction[];
};

export const rewardsFor = (balance: number, threshold = REWARD_THRESHOLD) => Math.floor(balance / threshold);
export const cycleProgress = (balance: number, threshold = REWARD_THRESHOLD) => balance % threshold;
export const remainingFor = (balance: number, threshold = REWARD_THRESHOLD) => {
  const progress = cycleProgress(balance, threshold);
  return progress === 0 && balance > 0 ? threshold : threshold - progress;
};

export function applyMovement(customer: Customer, type: TransactionType, delta: number, idempotencyKey: string, note?: string): Customer {
  const existing = customer.transactions.find(t => t.idempotencyKey === idempotencyKey);
  if (existing) return customer;
  const next = customer.balance + delta;
  if (next < 0) throw new Error("INSUFFICIENT_BALANCE");
  const transaction: LoyaltyTransaction = {
    id: crypto.randomUUID(), type, pointsDelta: delta, previousBalance: customer.balance,
    resultingBalance: next, createdAt: new Date().toISOString(), note, idempotencyKey,
  };
  return { ...customer, balance: next, transactions: [transaction, ...customer.transactions] };
}

export const earn = (customer: Customer, quantity: number, key: string = crypto.randomUUID()) => {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("INVALID_QUANTITY");
  return applyMovement(customer, "EARN", quantity, key);
};

export const redeem = (customer: Customer, key: string = crypto.randomUUID(), threshold = REWARD_THRESHOLD) => {
  if (customer.balance < threshold) throw new Error("INSUFFICIENT_BALANCE");
  return applyMovement(customer, "REDEEM", -threshold, key);
};

export const formatPhone = (value: string) => value.replace(/\D/g, "").slice(0, 13);
export const maskPhone = (value: string) => value.length > 4 ? `${value.slice(0, 2)} •••••• ${value.slice(-4)}` : value;
