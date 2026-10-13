import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (file: string) => readFileSync(resolve("src", file), "utf8");

describe("recursos operacionais preservados na publicação", () => {
  it("mantém a gestão completa e o caixa com reabertura na operação", () => {
    expect(source("AccessApp.tsx")).toContain("<OperationManagement");
    expect(source("OperationManualSale.tsx")).toContain("CashSessionActions");
  });
  it("mantém preparações cadastradas, tempos e edição na tela de custos", () => {
    const costs = source("OperationCosts.tsx");
    expect(costs).toContain("Preparações cadastradas");
    expect(costs).toContain("manager_get_costing_workspace_with_times");
    expect(costs).toContain("manager_save_costing_sheet_with_times");
  });
  it("mantém notas, fornecedores, edição e histórico de notas", () => {
    const invoices = source("CostPurchaseInvoice.tsx");
    for (const rpc of ["manager_get_costing_suppliers", "manager_get_costing_purchase_catalog", "manager_save_costing_purchase_invoice_v2", "manager_edit_costing_purchase_invoice", "manager_get_costing_invoice_revisions"])
      expect(invoices).toContain(rpc);
    expect(source("OperationCosts.tsx")).toContain("<CostPurchaseInvoice");
  });
  it("não rola a tela nem rouba o foco a cada tecla digitada na ficha ou na preparação", () => {
    const costs = source("OperationCosts.tsx");
    expect(costs).toContain("focusedModal.current = true");
    expect(costs).toContain("|| focusedModal.current) return;");
  });
  it("não rola a tela do editor de sabor a cada tecla digitada, só ao abrir para edição", () => {
    const admin = source("OperationContentAdmin.tsx");
    expect(admin).not.toMatch(/ref=\{\(node\)\s*=>\s*\{\s*if\s*\(node\s*&&\s*editing\)\s*node\.scrollIntoView/);
    expect(admin).toContain("scrolledForEditing.current === editing.id) return;");
  });
});
