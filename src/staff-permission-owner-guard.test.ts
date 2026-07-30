import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727041839_staff_permission_audit_and_owner_guard.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("proteção e auditoria da matriz de equipe", () => {
  it("impede gerente de alterar proprietários ou outros gestores", () => {
    expect(migration).toContain(
      "target_role in ('owner', 'manager') and not private.is_owner()",
    );
    expect(migration).toContain(
      "Somente o proprietário pode alterar permissões de proprietários e gestores",
    );
  });

  it("protege o último proprietário ativo e mudanças no próprio papel", () => {
    expect(migration).toContain("active_owner_count <= 1");
    expect(migration).toContain(
      "A operação precisa manter pelo menos um proprietário ativo",
    );
    expect(migration).toContain("target_user_id = actor_user_id");
    expect(migration).toContain(
      "Seu próprio papel e acesso devem ser alterados por outro proprietário",
    );
  });

  it("registra alterações de capacidade e papel na auditoria", () => {
    expect(migration).toContain("'staff.capability_changed'");
    expect(migration).toContain("'staff.member_changed'");
    expect(migration).toContain("'previous_role', current_staff_role");
    expect(migration).toContain("'capability', capability");
    expect(migration).toContain("set search_path = ''");
  });

  it("mantém execução fora de anon e exige usuário autenticado", () => {
    expect(migration).toMatch(
      /revoke all on function public\.manager_set_staff_capability\(uuid,uuid,text,boolean\)[\s\S]*from public, anon/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.manager_update_staff_member\(uuid,text,boolean\)[\s\S]*from public, anon/,
    );
    expect(migration).toContain("to authenticated");
  });
});
