import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260726203000_normalize_customer_names.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("normalização de nomes no banco", () => {
  it("cria função determinística e trigger no perfil", () => {
    expect(migration).toContain("private.normalize_person_name");
    expect(migration).toContain("immutable");
    expect(migration).toContain("profiles_normalize_full_name");
    expect(migration).toContain("before insert or update of full_name");
  });

  it("mantém partículas brasileiras e trata nomes compostos", () => {
    expect(migration).toContain("('da','das','de','do','dos','e')");
    expect(migration).toContain("private.capitalize_name_word(current_word)");
    expect(migration).toContain("character in ('-', '''', '’')");
  });

  it("registra relatório antes de corrigir dados existentes", () => {
    expect(migration).toContain("customer_name_normalization_audit");
    expect(
      migration.indexOf("insert into public.customer_name_normalization_audit"),
    ).toBeLessThan(migration.indexOf("update public.profiles profile"));
    expect(migration).toContain("normalization_batch");
  });

  it("restringe o relatório aos gestores", () => {
    expect(migration).toContain("using (private.is_manager())");
    expect(migration).toContain(
      "revoke insert, update, delete, truncate on public.customer_name_normalization_audit",
    );
  });
});
