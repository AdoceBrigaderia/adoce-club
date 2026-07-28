import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727090548_site_feedback_privacy_category_constraint.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("categoria de privacidade no feedback", () => {
  it("inclui privacy no constraint sem remover as categorias existentes", () => {
    expect(migration).toContain("site_feedback_category_check");
    for (const category of [
      "problem",
      "complaint",
      "suggestion",
      "compliment",
      "privacy",
    ]) {
      expect(migration).toContain(`'${category}'`);
    }
  });

  it("mantém a mudança transacional e restrita à tabela de feedback", () => {
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
    expect(migration).toContain("alter table public.site_feedback");
    expect(migration).not.toMatch(/truncate|delete from|drop table/i);
  });
});
