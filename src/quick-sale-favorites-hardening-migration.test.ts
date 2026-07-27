import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727090000_quick_sale_favorites_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("endurecimento dos favoritos da venda rápida", () => {
  it("adiciona índice reverso para exclusões e consultas por sabor", () => {
    expect(migration).toContain(
      "create index if not exists staff_quick_sale_favorites_flavor_idx",
    );
    expect(migration).toContain("(flavor_id, staff_profile_id)");
  });

  it("documenta e aplica negação explícita ao acesso direto", () => {
    expect(migration).toContain(
      "create policy staff_quick_sale_favorites_deny_direct",
    );
    expect(migration).toContain("as restrictive");
    expect(migration).toContain("to anon, authenticated");
    expect(migration).toContain("using (false)");
    expect(migration).toContain("with check (false)");
    expect(migration).toContain("operações passam pelo BFF e RPCs autorizados");
  });
});
