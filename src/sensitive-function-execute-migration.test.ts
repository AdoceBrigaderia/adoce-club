import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260726160651_lock_sensitive_function_execute.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("menor privilégio das funções operacionais", () => {
  it("revoga PUBLIC e anon de rotinas sensíveis SECURITY DEFINER", () => {
    expect(migration).toContain("p.proname ~ '^(staff_|manager_|owner_|record_owner_)'");
    expect(migration).toContain("revoke all on function %I.%I(%s) from public, anon");
    expect(migration).toContain("p.prosecdef");
    expect(migration).toContain("pg_get_function_identity_arguments");
  });

  it("desativa integralmente a superfície RPC do protótipo aposentado", () => {
    expect(migration).toContain("p.proname ~ '^pilot_'");
    expect(migration).toContain(
      "revoke all on function %I.%I(%s) from public, anon, authenticated",
    );
  });

  it("falha se uma função sensível continuar acessível anonimamente", () => {
    expect(migration).toContain("has_function_privilege(");
    expect(migration).toContain("'anon'");
    expect(migration).toContain("'EXECUTE'");
    expect(migration).toContain("sensitive functions remain executable by anon");
  });
});
