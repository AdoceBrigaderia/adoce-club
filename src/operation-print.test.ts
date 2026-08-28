import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = [
  "./OperationInstantOrders.tsx",
  "./OperationCommercialAdmin.tsx",
  "./OperationPedeJunto.tsx",
  "./AccessApp.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
const styles = readFileSync(new URL("./operation-print.css", import.meta.url), "utf8");
const helper = readFileSync(new URL("./lib/operation-print.ts", import.meta.url), "utf8");

describe("impressão e PDF na operação", () => {
  it("oferece impressão nas fichas operacionais essenciais", () => {
    for (const source of files) {
      expect(source).toContain("printOperation(");
      expect(source).toContain("print-scope");
    }
  });

  it("mantém A4/PDF e oferece cupom de 58 mm nos pedidos", () => {
    expect(files[0]).toContain('printOperation("thermal")');
    expect(files[1]).toContain('printOperation("thermal")');
    expect(files[2]).toContain('printOperation("thermal")');
    expect(files[3]).toContain('printOperation("a4")');
    expect(helper).toContain("dataset.operationPrintFormat = format");
    expect(helper).toContain("window.print()");
  });

  it("gera versões limpas para A4 e bobina térmica", () => {
    expect(styles).toContain("@media print");
    expect(styles).toContain("visibility: hidden");
    expect(styles).toContain("customer-account-admin");
    expect(styles).toContain("@page operation-a4");
    expect(styles).toContain("@page receipt-58mm");
    expect(styles).toContain("size: 58mm 210mm");
    expect(styles).toContain("width: 48mm");
    expect(styles).toContain('data-operation-print-format="thermal"');
  });
});
