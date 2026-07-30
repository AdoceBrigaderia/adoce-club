import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260729203000_harden_service_request_store_scope.sql";
const migration = readFileSync(resolve(process.cwd(), migrationPath), "utf8");
const manifest = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "security/service-request-table-surface.json"),
    "utf8",
  ),
) as { hardeningMigration?: string };

describe("hardening do escopo de loja das encomendas", () => {
  it("mantém o hardening vinculado ao manifesto versionado", () => {
    expect(manifest.hardeningMigration).toBe(migrationPath);
  });

  it("bloqueia dados históricos sem loja quando não há resolução inequívoca", () => {
    expect(migration).toContain("where request.store_id is null");
    expect(migration).toContain("active_store_count <> 1");
    expect(migration).toContain("faça o mapeamento explícito antes de continuar");
    expect(migration).toContain("Service requests still contain rows without store scope");
  });

  it("exige escopo de loja no commit sem impedir o wrapper transacional", () => {
    expect(migration).toContain("create constraint trigger service_requests_store_scope_required");
    expect(migration).toContain("after insert or update of store_id on public.service_requests");
    expect(migration).toContain("deferrable initially deferred");
    expect(migration).toContain("private.assert_service_request_store_scope()");
    expect(migration).toContain("trigger_info.tgdeferrable");
    expect(migration).toContain("trigger_info.tginitdeferred");
  });

  it("impede o service role de chamar implementações sem escopo", () => {
    for (const functionName of [
      "submit_service_request_bff_unscoped_internal",
      "staff_get_service_request_workspace_unscoped_internal",
      "staff_get_customer_service_request_history_unscoped_internal",
    ]) {
      expect(migration).toContain(functionName);
    }
    expect(migration.match(/from public, anon, authenticated, service_role;/g)?.length).toBe(4);
    expect(migration).toContain("has_function_privilege('service_role', signature, 'EXECUTE')");
    expect(migration).toContain("Internal service-request functions remain executable by service_role");
  });

  it("permanece transacional e não publica nem aplica outras migrations", () => {
    expect(migration.trimStart().startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).not.toContain("netlify deploy");
    expect(migration).not.toContain("supabase db push");
    expect(migration).not.toContain("supabase migration up");
  });
});
