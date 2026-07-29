import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260729212000_scope_service_request_workspace_by_store.sql",
    import.meta.url,
  ),
  "utf8",
);
const source = readFileSync(
  new URL("./OperationServiceRequests.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("./operation-service-requests.css", import.meta.url),
  "utf8",
);

describe("workspace de encomendas isolado por loja", () => {
  it("remove a assinatura antiga e mantém somente o contrato com loja opcional", () => {
    expect(migration).toContain(
      "drop function if exists public.staff_get_service_request_workspace(text,text,integer)",
    );
    expect(migration).toContain("target_store_id uuid default null");
    expect(migration).toContain(
      "public.staff_get_service_request_workspace(text,text,integer,uuid)",
    );
    expect(migration).toContain(
      "to_regprocedure('public.staff_get_service_request_workspace(text,text,integer)')",
    );
  });

  it("aplica capacidade por loja em todas as encomendas e no filtro solicitado", () => {
    expect(migration).toContain(
      "private.staff_has_any_capability('manage_orders')",
    );
    expect(migration).toContain(
      "private.staff_has_capability(target_store_id, 'manage_orders')",
    );
    expect(migration).toContain(
      "private.staff_has_capability(request.store_id, 'manage_orders')",
    );
    expect(migration).toContain(
      "target_store_id is null or request.store_id = target_store_id",
    );
    expect(migration).toContain(
      "join public.stores store on store.id = request.store_id",
    );
    expect(migration).not.toContain(
      "assignment.can_manage_orders\n         )\n       )",
    );
  });

  it("restringe custos pela capacidade financeira da mesma loja", () => {
    expect(
      migration.match(
        /private\.staff_has_capability\(request\.store_id, 'view_finance'\)/g,
      )?.length,
    ).toBeGreaterThanOrEqual(3);
    expect(migration).not.toContain(
      "when private.is_manager() then cake.estimated_internal_cost",
    );
    expect(migration).not.toContain(
      "when private.is_manager() then configured.estimated_internal_cost",
    );
  });

  it("mantém o BFF autenticado e fecha o acesso anônimo", () => {
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
    expect(migration).toContain(
      "has_function_privilege('anon', new_routine, 'EXECUTE')",
    );
    expect(migration).toContain(
      "has_function_privilege('authenticated', new_routine, 'EXECUTE')",
    );
  });

  it("oferece seleção explícita de unidade sem acesso direto ao Supabase", () => {
    expect(source).toContain(
      'bffRpc<BusinessWorkspace>("staff_get_business_workspace")',
    );
    expect(source).toContain("target_store_id: nextStoreId || null");
    expect(source).toContain("Todas as lojas acessíveis");
    expect(source).toContain("item.request_number} · {item.store.name");
    expect(source).not.toContain("requireSupabase");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
  });

  it("preserva controles grandes e empilhamento móvel", () => {
    expect(styles).toContain("min-height: 3.25rem");
    expect(styles).toContain("min-height: 2.75rem");
    expect(styles).toContain("@media (max-width: 760px)");
    expect(styles).toContain("flex-direction: column");
    expect(styles).toContain("width: 100%");
  });
});
