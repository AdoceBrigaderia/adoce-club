import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = [
  "./OperationInstantOrders.tsx",
  "./OperationCommercialAdmin.tsx",
  "./OperationPedeJunto.tsx",
  "./AccessApp.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
const styles = readFileSync(new URL("./operation-print.css", import.meta.url), "utf8");

describe("impressão e PDF na operação", () => {
  it("oferece a ação nas fichas operacionais essenciais", () => {
    for (const source of files) {
      expect(source).toContain("Imprimir ou salvar em PDF");
      expect(source).toContain("window.print()");
      expect(source).toContain("print-scope");
    }
  });

  it("gera uma versão limpa sem controles internos", () => {
    expect(styles).toContain("@media print");
    expect(styles).toContain("visibility: hidden");
    expect(styles).toContain("customer-account-admin");
  });
});
