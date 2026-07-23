import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("cancelamento de pedidos na operação", () => {
  const source = readFileSync(new URL("./OperationCommercialAdmin.tsx", import.meta.url), "utf8");
  const permissionMigration = readFileSync(new URL("../supabase/migrations/20260723003122_allow_manager_service_request_audit.sql", import.meta.url), "utf8");

  it("explica o motivo obrigatório junto da ação e só habilita a confirmação quando válido", () => {
    expect(source).toContain("Conte o motivo em mais");
    expect(source).toContain("Motivo pronto para ser registrado no histórico.");
    expect(source).toContain("busy || cancellationReason.trim().length < 5");
  });

  it("preserva o pedido cancelado no histórico em vez de apagá-lo sem rastreabilidade", () => {
    expect(source).toContain("O pedido sairá da fila ativa, mas continuará no histórico para consulta.");
    expect(source).toContain('next_status: "cancelled"');
    expect(source).toContain('setRequestFilter("active")');
    expect(source).toContain("foi cancelado e movido para Histórico");
    expect(source).not.toContain('await updateRequest({ ...request, internal_notes: internalNotes }, "cancelled")');
  });

  it("permite que proprietários e gerentes gravem a auditoria atômica do cancelamento", () => {
    expect(permissionMigration).toContain("create policy audit_manager_insert");
    expect(permissionMigration).toContain("private.is_manager()");
    expect(permissionMigration).toContain("actor_user_id = (select auth.uid())");
    expect(permissionMigration).toContain("revoke execute on function public.manager_update_service_request");
    expect(permissionMigration).toContain("from anon");
  });

  it("mostra a falha dentro da lateral em vez de escondê-la atrás do painel", () => {
    expect(source).toContain("drawer-cancellation-failure");
    expect(source).toContain('role="alert"');
    expect(source).toContain('setCancellationError(message)');
    expect(source).toContain('busy ? "Cancelando..." : "Confirmar cancelamento"');
  });

  it("oferece o cancelamento também no painel de relacionamento do CRM", () => {
    expect(source).toContain('className="operation-crm-cancellation"');
    expect(source).toContain("Cancelar esta pré-reserva");
    expect(source).toContain("Cancelar pré-reserva");
    expect(source).toContain("onClick={() => void cancelRequest(selectedRequest)}");
    expect(source).toContain("Ela sai dos pedidos ativos, libera a agenda");
    expect(source).toContain("const openRequest = (request: ServiceRequest)");
    expect(source).toContain("setShowCancellation(false)");
  });
});
