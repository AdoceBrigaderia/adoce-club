export type SupplierInvoiceInput = {
  kind: "real" | "cost_adjustment";
  invoiceNumber: string;
  issuedOn: string;
  purchasedOn: string;
  amountCents: number;
  paymentMethod: string;
  paymentState: "paid" | "payable";
  paidOn: string | null;
  paidAmountCents: number | null;
  dueOn: string | null;
};

const validDate = (value: string | null): boolean => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export function shouldExportSupplierInvoice(invoice: Pick<SupplierInvoiceInput, "kind">): boolean {
  return invoice.kind === "real";
}

export function validateSupplierInvoice(invoice: SupplierInvoiceInput): string[] {
  const errors: string[] = [];
  if (!invoice.invoiceNumber.trim()) errors.push("Informe o número da nota.");
  if (!validDate(invoice.issuedOn)) errors.push("Informe a data de emissão da nota.");
  if (!validDate(invoice.purchasedOn)) errors.push("Informe a data da compra.");
  if (!Number.isInteger(invoice.amountCents) || invoice.amountCents <= 0) errors.push("O valor da nota deve ser em centavos inteiros e maior que zero.");
  if (!invoice.paymentMethod.trim()) errors.push("Informe a forma de pagamento.");
  if (invoice.paymentState === "paid") {
    if (!validDate(invoice.paidOn) || !Number.isInteger(invoice.paidAmountCents) || (invoice.paidAmountCents ?? 0) <= 0) {
      errors.push("Informe a data e o valor efetivamente pagos.");
    }
    if (invoice.dueOn !== null) errors.push("Nota paga não pode ter vencimento pendente.");
  } else {
    if (!validDate(invoice.dueOn)) errors.push("Informe o vencimento da nota.");
    if (invoice.paidOn !== null || invoice.paidAmountCents !== null) errors.push("Nota a pagar não pode ter pagamento confirmado.");
  }
  return errors;
}
