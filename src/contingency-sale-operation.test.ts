import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPERATION_RPC_ALLOWLIST } from "../netlify/functions/_shared/bff-rpc-policy";

const sale = readFileSync(
  new URL("./OperationContingencySale.tsx", import.meta.url),
  "utf8",
);
const reconciliation = readFileSync(
  new URL("./OperationCashReconciliation.tsx", import.meta.url),
  "utf8",
);
const hub = readFileSync(
  new URL("./OperationBusinessHub.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("./operation-contingency.css", import.meta.url),
  "utf8",
);

describe("venda em contingencia e reconciliacao", () => {
  it("usa exclusivamente RPCs protegidos pelo BFF", () => {
    expect(OPERATION_RPC_ALLOWLIST).toContain(
      "manager_create_manual_sale_for_reconciliation",
    );
    expect(OPERATION_RPC_ALLOWLIST).toContain(
      "staff_get_cash_reconciliation_queue",
    );
    expect(OPERATION_RPC_ALLOWLIST).toContain("manager_reconcile_cash_sale");
    expect(sale).not.toContain("requireSupabase");
    expect(sale).not.toContain("Authorization");
    expect(reconciliation).not.toContain("requireSupabase");
    expect(reconciliation).not.toContain("Authorization");
  });

  it("registra a venda em um unico toque final e gera idempotencia", () => {
    expect(sale).toContain("manager_create_manual_sale_for_reconciliation");
    expect(sale).toContain("contingency-sale:${crypto.randomUUID()}");
    expect(sale).toContain("Registrar para reconciliar");
    expect(sale).toContain("requested_items: items");
    expect(sale).toContain("requested_payment_method: method");
  });

  it("permite reconciliar somente em caixa aberto da mesma loja", () => {
    expect(reconciliation).toContain('item.status === "open"');
    expect(reconciliation).toContain("session.store_id === item.store_id");
    expect(reconciliation).toContain("manager_reconcile_cash_sale");
    expect(reconciliation).toContain(
      "cash-reconciliation:${crypto.randomUUID()}",
    );
  });

  it("fica acessivel diretamente na central operacional", () => {
    expect(hub).toContain("<OperationContingencySale />");
    expect(hub).toContain("<OperationCashReconciliation />");
    expect(hub.indexOf("<OperationContingencySale />")).toBeLessThan(
      hub.indexOf("<OperationQuickCash"),
    );
  });

  it("mantem alvos grandes para celular e tablet", () => {
    expect(styles).toContain("min-height:68px");
    expect(styles).toContain("min-height:58px");
    expect(styles).toContain("@media(max-width:760px)");
  });
});
