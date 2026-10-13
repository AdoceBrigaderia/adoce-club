import { describe, expect, it } from "vitest";
import { validateSupplierInvoice, shouldExportSupplierInvoice, type SupplierInvoiceInput } from "./supplier-invoices";

const real: SupplierInvoiceInput = {
  kind: "real",
  invoiceNumber: "1234",
  issuedOn: "2026-10-06",
  purchasedOn: "2026-10-05",
  amountCents: 15990,
  paymentMethod: "pix",
  paymentState: "paid",
  paidOn: "2026-10-05",
  paidAmountCents: 15990,
  dueOn: null,
};

describe("nota de fornecedor", () => {
  it("aceita nota real paga no dia anterior sem vencimento futuro", () => {
    expect(validateSupplierInvoice(real)).toEqual([]);
    expect(shouldExportSupplierInvoice(real)).toBe(true);
  });

  it("exige uma única situação de pagamento e valores em centavos", () => {
    expect(validateSupplierInvoice({ ...real, paymentState: "payable", dueOn: "2026-10-15" })).toContain("Nota a pagar não pode ter pagamento confirmado.");
    expect(validateSupplierInvoice({ ...real, amountCents: 159.9 })).toContain("O valor da nota deve ser em centavos inteiros e maior que zero.");
  });

  it("aceita nota a pagar com um vencimento, inclusive já vencido", () => {
    expect(validateSupplierInvoice({ ...real, paymentState: "payable", dueOn: "2026-10-04", paidOn: null, paidAmountCents: null })).toEqual([]);
  });

  it("mantém nota de ajuste de custo fora do financeiro", () => {
    expect(shouldExportSupplierInvoice({ ...real, kind: "cost_adjustment" })).toBe(false);
  });
});
