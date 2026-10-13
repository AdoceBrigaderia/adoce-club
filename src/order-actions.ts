export const canStartPreparation = (status: string) => ["reserved", "awaiting_payment", "paid"].includes(status);
export const canReceivePayment = (status: string, paymentStatus: string) =>
  ["reserved", "awaiting_payment", "preparing"].includes(status) && paymentStatus !== "approved";
export const canCancelOrder = (status: string) =>
  !["completed", "cancelled"].includes(status);
export const canApplyExistingOrderReward = (status: string, paymentStatus: string, paidAt?: string | null) =>
  ["awaiting_confirmation", "reserved", "awaiting_payment", "preparing"].includes(status)
  && ["not_started", "pending"].includes(paymentStatus) && !paidAt;
