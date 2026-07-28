import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260728170941_lock_private_cake_builder_helper.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("helpers privados do montador de tortas", () => {
  it("não deixa custo interno executável por papéis do navegador", () => {
    expect(migration).toMatch(
      /revoke all on function private\.canonicalize_cake_builder_selection\(uuid,jsonb\)[\s\S]*from public, anon, authenticated;/,
    );
    expect(migration).toMatch(
      /revoke all on function private\.cake_builder_distinct_uuid_array\(uuid\[\]\)[\s\S]*from public, anon, authenticated;/,
    );
    expect(migration).toContain("to service_role");
  });
});
