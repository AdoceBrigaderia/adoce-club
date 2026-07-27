import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727033000_cash_reconciliation_queue.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("fila transacional de reconciliacao de caixa", () => {
  it("restringe contingencia e reconciliacao a proprietario ou gestor", () => {
    expect(migration.match(/not private\.is_manager\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain("Apenas proprietarios e gestores podem registrar venda em contingencia");
    expect(migration).toContain("Apenas proprietarios e gestores podem reconciliar vendas");
  });

  it("calcula a venda no backend e registra fila idempotente", () => {
    expect(migration).toContain("sale_result := public.staff_create_manual_sale(");
    expect(migration).toContain("idempotency_key text not null unique");
    expect(migration).toContain("where q.idempotency_key = operation_key");
    expect(migration).toContain("target_order.total");
    expect(migration).toContain("cash_movement_recorded', false");
  });

  it("reconcilia com bloqueio e movimento de caixa na mesma transacao", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("perform public.staff_record_cash_movement(");
    expect(migration).toContain("session_record.store_id <> queue_record.store_id");
    expect(migration).toContain("reconciliation_operation_key = operation_key");
    expect(migration).toContain("cash_movement_recorded', true");
  });

  it("mantem trilha de auditoria e integracao", () => {
    expect(migration).toContain("cash_reconciliation.created");
    expect(migration).toContain("cash_reconciliation.reconciled");
    expect(migration).toContain("cash.reconciliation.created");
    expect(migration).toContain("cash.reconciliation.completed");
  });

  it("nao libera a tabela diretamente ao navegador", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain(
      "revoke all on table public.cash_reconciliation_queue from anon, authenticated",
    );
    expect(migration).toContain(
      "revoke all on function public.manager_create_manual_sale_for_reconciliation",
    );
    expect(migration).toContain(
      "grant execute on function public.manager_reconcile_cash_sale",
    );
  });
});
