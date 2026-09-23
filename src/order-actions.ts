export const canStartPreparation = (status: string) => ["reserved", "awaiting_payment", "paid"].includes(status);
export const canReceivePayment = (status: string, paymentStatus: string) =>
  ["reserved", "awaiting_payment", "preparing"].includes(status) && paymentStatus !== "approved";
export const canCancelOrder = (status: string) =>
  !["completed", "cancelled"].includes(status);
