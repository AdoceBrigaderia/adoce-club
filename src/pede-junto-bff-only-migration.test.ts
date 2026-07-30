import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727033336_pede_junto_bff_only.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("RPCs do Pede Junto somente pelo BFF", () => {
  const functions = [
    "create_pede_junto_group(text,text,text,text,text)",
    "join_pede_junto_group(text,text,text,text)",
    "pede_junto_room(text,text,text)",
    "set_pede_junto_selection(text,text,uuid,integer)",
    "submit_pede_junto_group(text,text)",
  ];

  it("remove execução pública, anônima e autenticada", () => {
    for (const name of functions) {
      expect(migration).toContain(`revoke all on function public.${name}`);
    }
    expect(migration).toContain("from public, anon, authenticated");
  });

  it("permite execução somente ao backend", () => {
    for (const name of functions) {
      expect(migration).toContain(`grant execute on function public.${name}`);
    }
    expect(migration).toContain("to service_role");
    expect(migration).not.toContain("to anon");
    expect(migration).not.toContain("to authenticated");
  });
});
