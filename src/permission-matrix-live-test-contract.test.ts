import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../supabase/tests/permission_matrix_live.sql", import.meta.url),
  "utf8",
);

describe("contrato do ensaio vivo da matriz de permissões", () => {
  it("sempre executa em transação revertida", () => {
    expect(sql.trimStart()).toMatch(/^begin;/i);
    expect(sql.trimEnd()).toMatch(/rollback;$/i);
  });

  it("cobre capacidade permitida, negada e isolamento entre lojas", () => {
    expect(sql).toContain("private.staff_has_capability(primary_store, 'sell')");
    expect(sql).toContain(
      "private.staff_has_capability(primary_store, 'view_finance')",
    );
    expect(sql).toContain("private.can_access_store(secondary_store)");
    expect(sql).toContain(
      "private.staff_has_capability(secondary_store, 'sell')",
    );
    expect(sql).toContain("Produção acessou capacidade não atribuída na outra loja");
  });

  it("cobre auditoria e proteção de proprietário", () => {
    expect(sql).toContain("action = 'staff.capability_changed'");
    expect(sql).toContain("Gerente conseguiu alterar proprietário");
    expect(sql).toContain("Proprietário conseguiu alterar o próprio papel");
  });
});
