import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260729223000_harden_operational_reports_by_store_and_finance.sql",
    import.meta.url,
  ),
  "utf8",
);
const ui = readFileSync(new URL("./OperationReports.tsx", import.meta.url), "utf8");

describe("hardening dos relatórios operacionais", () => {
  it("filtra lojas no backend antes de agregar pedidos, caixa, check-ins e encomendas", () => {
    expect(migration).toContain("private.staff_has_capability(store.id, 'view_reports')");
    expect(migration).toContain("join report_stores store on store.id = customer_order.store_id");
    expect(migration).toContain("join report_stores store on store.id = session.store_id");
    expect(migration).toContain("join report_stores store on store.id = movement.store_id");
    expect(migration).toContain("join report_stores store on store.id = checkin.store_id");
    expect(migration).toContain("join report_stores store on store.id = request.store_id");
  });

  it("redige valores quando a permissão financeira não cobre todo o escopo", () => {
    expect(migration).toContain("private.staff_has_capability(store.id, 'view_finance')");
    expect(migration).toContain("finance_scope_complete");
    expect(migration).toContain("else null");
    expect(migration).toContain("where (select finance_scope_complete from scope_flags)");
    expect(ui).toContain("Protegido por permissão");
    expect(ui).toContain("Valores, formas de pagamento e diferenças de caixa ficam ocultos");
    expect(ui).toContain("value === null || value === undefined ? null");
  });

  it("incorpora encomendas e movimentações financeiras calculadas no backend", () => {
    expect(migration).toContain("scoped_service_requests");
    expect(migration).toContain("service_requests_by_status");
    expect(migration).toContain("request.paid_amount");
    expect(migration).toContain("request.payment_status = 'refund_pending'");
    expect(migration).toContain("movement.kind = 'expense'");
    expect(migration).toContain("movement.kind = 'refund'");
    expect(ui).toContain("Encomendas por etapa");
    expect(ui).toContain("Movimentações de caixa");
  });

  it("não apresenta métricas globais de clientes como se fossem da loja selecionada", () => {
    expect(migration).toContain("global_metrics_authorized := private.is_manager() and target_store_id is null");
    expect(migration).toContain("case when global_metrics_authorized");
    expect(ui).toContain("Somente visão global");
  });

  it("mantém a função somente no BFF autenticado", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
    expect(ui).toContain('bffRpc<ReportsData>("staff_get_operational_reports"');
    expect(ui).not.toContain("localStorage");
    expect(ui).not.toContain("sessionStorage");
  });
});
