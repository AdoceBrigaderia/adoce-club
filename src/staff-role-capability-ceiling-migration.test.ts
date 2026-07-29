import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260729105000_staff_role_capability_ceiling.sql",
    import.meta.url,
  ),
  "utf8",
);

const liveTest = readFileSync(
  new URL("../supabase/tests/permission_matrix_live.sql", import.meta.url),
  "utf8",
);

describe("teto de capacidades por papel e loja", () => {
  it("define a matriz fail-closed dos seis papéis", () => {
    expect(migration).toContain("private.staff_role_allows_capability");
    ["owner", "manager", "attendant", "cashier", "production", "viewer"].forEach(
      (role) => expect(migration).toContain(`when '${role}'`),
    );
    expect(migration).toContain("else false");
    expect(migration).toContain("A atribuição por loja nunca amplia o papel");
  });

  it("faz a autorização efetiva combinar papel, loja e flag", () => {
    expect(migration).toMatch(
      /create or replace function private\.staff_has_capability[\s\S]*private\.staff_role_allows_capability\(member\.role::text, requested_capability\)/,
    );
    expect(migration).toContain("assignment.store_id = target_store_id");
    expect(migration).toContain("assignment.active");
    expect(migration).toContain("when 'manage_loyalty' then assignment.can_manage_customers");
  });

  it("impede RPCs administrativos de ampliar o teto do papel", () => {
    expect(migration).toMatch(
      /allowed and not private\.staff_role_allows_capability\(target_role, capability\)/,
    );
    expect(migration).toContain("A função selecionada não permite esta ação");
    expect(migration).toContain("A função selecionada não permite abrir caixa");
    expect(migration).toContain("role_ceiling_enforced");
  });

  it("normaliza flags antigas e mudanças futuras de papel", () => {
    expect(migration).toContain("Matriz de permissões normalizada");
    expect(migration).toMatch(
      /create or replace function public\.manager_update_staff_member[\s\S]*normalized_assignment_count/,
    );
    expect(migration).toContain("can_manage_settings = assignment.can_manage_settings");
    expect(migration).toContain("get diagnostics normalized_assignment_count = row_count");
  });

  it("serializa a proteção do último proprietário ativo", () => {
    expect(migration).toMatch(
      /where member\.role::text = 'owner'[\s\S]*order by member\.user_id[\s\S]*for update/,
    );
    expect(migration).toContain("active_owner_count <= 1");
    expect(migration).toContain("owner_change_serialized");
  });

  it("mantém os RPCs fora de anon e o helper privado sem execução pública", () => {
    expect(migration).toMatch(
      /revoke all on function private\.staff_role_allows_capability\(text,text\)[\s\S]*from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.manager_set_staff_store_assignment[\s\S]*from public, anon/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.manager_set_staff_capability\(uuid,uuid,text,boolean\)[\s\S]*from public, anon/,
    );
  });

  it("amplia o ensaio vivo para todos os papéis e nega flags residuais", () => {
    ["attendant", "cashier", "production", "viewer", "manager"].forEach((role) =>
      expect(liveTest).toContain(`'${role}'::public.staff_role`),
    );
    expect(liveTest).toContain("ultrapassou o teto do próprio papel");
    expect(liveTest).toContain("Mudança de papel não normalizou as atribuições persistidas");
    expect(liveTest).toContain("A proteção concorrente do último proprietário não está ativa");
    expect(liveTest.trim().endsWith("rollback;")).toBe(true);
  });
});
