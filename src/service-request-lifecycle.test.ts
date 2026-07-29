import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPERATION_RPC_ALLOWLIST } from "../netlify/functions/_shared/bff-rpc-policy";

const lifecycleMigration = readFileSync(
  new URL("../supabase/migrations/20260729221000_manage_service_request_lifecycle.sql", import.meta.url),
  "utf8",
);
const productionMigration = readFileSync(
  new URL("../supabase/migrations/20260729221200_protect_service_request_production_actions.sql", import.meta.url),
  "utf8",
);
const workspaceMigration = readFileSync(
  new URL("../supabase/migrations/20260729221600_redact_service_request_production_workspace.sql", import.meta.url),
  "utf8",
);
const interfaceSource = readFileSync(
  new URL("./OperationServiceRequests.tsx", import.meta.url),
  "utf8",
);

describe("ciclo operacional das encomendas", () => {
  it("mantém transições financeiras transacionais, idempotentes e auditadas", () => {
    expect(lifecycleMigration).toContain("for update");
    expect(lifecycleMigration).toContain("pg_advisory_xact_lock");
    expect(lifecycleMigration).toContain("audit_logs_service_request_operation_key_idx");
    expect(lifecycleMigration).toContain("public.service_request_pricing_snapshots");
    expect(lifecycleMigration).toContain("private.staff_has_capability(request_row.store_id, 'manage_orders')");
    expect(lifecycleMigration).toContain("private.staff_has_capability(request_row.store_id, 'view_finance')");
    expect(lifecycleMigration).toContain("'service_request_transition'");
    expect(lifecycleMigration).toContain("grant execute on function public.staff_transition_service_request");
    expect(lifecycleMigration).not.toContain("grant execute on function public.staff_transition_service_request(uuid,uuid,text,numeric,text,text)\n  to anon");
  });

  it("calcula orçamento e sinal no backend sem aceitar total do navegador", () => {
    expect(lifecycleMigration).toContain("backend_total * requested_deposit_fraction");
    expect(lifecycleMigration).toContain("snapshot.total_price");
    expect(lifecycleMigration).not.toContain("requested_total");
    expect(lifecycleMigration).not.toContain("requested_paid_amount");
    expect(lifecycleMigration).toContain("requested_deposit_fraction < 0.05");
    expect(lifecycleMigration).toContain("requested_deposit_fraction > 1");
  });

  it("separa atendimento, financeiro e produção por capacidade efetiva da loja", () => {
    expect(productionMigration).toContain("service_requests_production_capability_guard");
    expect(productionMigration).toContain("private.staff_has_capability(request_row.store_id, 'manage_production')");
    expect(productionMigration).toContain("for update");
    expect(workspaceMigration).toContain("private.staff_has_any_capability('manage_production')");
    expect(workspaceMigration).toContain("else 'Cliente protegido'");
    expect(workspaceMigration).toContain("'permissions', jsonb_build_object");
    expect(workspaceMigration).toContain("'view_finance', private.staff_has_capability");
  });

  it("expõe somente os dois RPCs controlados pelo BFF", () => {
    expect(OPERATION_RPC_ALLOWLIST).toContain("staff_transition_service_request");
    expect(OPERATION_RPC_ALLOWLIST).toContain("staff_transition_service_request_production");
    expect(interfaceSource).toContain('bffRpc<LifecycleResult>("staff_transition_service_request"');
    expect(interfaceSource).toContain('bffRpc<LifecycleResult>("staff_transition_service_request_production"');
    expect(interfaceSource).toContain("crypto.randomUUID()");
    expect(interfaceSource).not.toContain("supabase.rpc");
    expect(interfaceSource).not.toContain("localStorage");
  });

  it("mantém botões rápidos e dados financeiros condicionados à permissão", () => {
    expect(interfaceSource).toContain("item.permissions.manage_orders");
    expect(interfaceSource).toContain("item.permissions.manage_production");
    expect(interfaceSource).toContain("item.permissions.view_finance");
    expect(interfaceSource).toContain('"Pedir sinal 50%"');
    expect(interfaceSource).toContain('"Iniciar produção"');
    expect(interfaceSource).toContain('"Marcar pronta"');
    expect(interfaceSource).toContain('"Concluir retirada"');
    expect(interfaceSource).toContain('"Confirmar estorno"');
  });
});
