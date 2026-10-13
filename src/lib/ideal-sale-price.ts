export const defaultIdealSalePrice = 18;
export function parseIdealSalePrice(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 && price < 100000000 ? price : null;
}
export function parsePaymentFeePercent(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,4})?$/.test(normalized)) return null;
  const percent = Number(normalized);
  return Number.isFinite(percent) && percent >= 0 && percent < 100 ? percent : null;
}
export function weightedPaymentFeePercent(payments: { amount: number; fee: number }[]): number | null {
  if (payments.some(p => !Number.isFinite(p.amount) || !Number.isFinite(p.fee) || p.amount < 0 || p.fee < 0)) return null;
  const gross = payments.reduce((sum, p) => sum + p.amount, 0);
  return gross > 0 ? payments.reduce((sum, p) => sum + p.fee, 0) / gross * 100 : null;
}
export function idealSaleMargin(cost: number | null, price: number | null, paymentFeePercent = 0): { amount: number; percent: number } | null {
  if (cost == null || price == null || !Number.isFinite(cost) || !Number.isFinite(price) || cost < 0 || price <= 0) return null;
  if (!Number.isFinite(paymentFeePercent) || paymentFeePercent < 0 || paymentFeePercent >= 100) return null;
  const amount = price * (1 - paymentFeePercent / 100) - cost;
  return { amount, percent: amount / price * 100 };
}
