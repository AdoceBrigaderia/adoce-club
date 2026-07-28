import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260728223000_service_request_configuration_workspace.sql", import.meta.url),
  "utf8",
);
const component = readFileSync(
  new URL("./OperationConfiguredOrders.tsx", import.meta.url),
  "utf8",
);
const hub = readFileSync(new URL("./OperationBusinessHub.tsx", import.meta.url), "utf8");
const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("central segura de encomendas configuradas", () => {
  it("une pedido, produto, torta, configuração e snapshot financeiro", () => {
    expect(migration).toContain("left join public.service_request_cake_builds");
    expect(migration).toContain("left join public.service_request_product_configurations");
    expect(migration).toContain("left join public.service_request_pricing_snapshots");
    expect(migration).toContain("'summary', configured.selection_summary");
    expect(migration).toContain("'selection', configured.canonical_selection");
  });

  it("oculta custo e margem completos de perfis não gerenciais", () => {
    expect(migration).toContain("case when private.is_manager() then configured.estimated_internal_cost else null end");
    expect(migration).toContain("when private.is_manager() then jsonb_build_object");
    expect(migration).toContain("'total_cost', pricing.total_cost");
    expect(migration).toContain("else jsonb_build_object");
  });

  it("exige equipe ativa com permissão de pedidos", () => {
    expect(migration).toContain("staff.role::text in ('owner', 'manager')");
    expect(migration).toContain("assignment.can_manage_orders");
    expect(migration).toContain("Acesso às encomendas não autorizado");
    expect(migration).toContain("revoke all on function public.staff_get_service_request_workspace");
  });

  it("interface usa somente BFF e mostra escolhas estruturadas", () => {
    expect(component).toContain('bffRpc<ConfiguredOrder[]>("staff_get_service_request_workspace"');
    expect(component).not.toContain("requireSupabase");
    expect(component).not.toContain(".from(");
    expect(component).toContain("Sabores, quantidades e adicionais");
    expect(component).toContain("Escolhas registradas");
    expect(component).toContain("margin_alert");
    expect(policy).toContain('"staff_get_service_request_workspace"');
  });

  it("fica visível no fluxo principal da operação", () => {
    expect(hub).toContain('import OperationConfiguredOrders from "./OperationConfiguredOrders"');
    expect(hub).toContain("<OperationConfiguredOrders");
  });
});
