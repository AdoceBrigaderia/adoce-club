import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727134000_site_feedback_profile_index.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("índice do vínculo de perfil no feedback", () => {
  it("cria um índice parcial e idempotente para a chave estrangeira", () => {
    expect(migration).toContain(
      "create index if not exists site_feedback_profile_id_idx",
    );
    expect(migration).toContain("on public.site_feedback (profile_id)");
    expect(migration).toContain("where profile_id is not null");
  });

  it("mantém a alteração limitada a uma transação", () => {
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
    expect(migration).not.toMatch(/drop table|truncate|delete from/i);
  });
});
