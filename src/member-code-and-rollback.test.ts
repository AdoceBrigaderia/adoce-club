import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260718184839_add_member_codes_and_rollback_audit.sql", import.meta.url),
  "utf8",
);
const memberArea = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const landing = readFileSync(new URL("./MarketingLanding.tsx", import.meta.url), "utf8");
const clubExperience = readFileSync(new URL("./ClubExperience.tsx", import.meta.url), "utf8");

describe("terminologia do Clube Adoce", () => {
  it("mantém os textos principais exatamente como definidos", () => {
    expect(landing).toContain("Cada fatia vale um carimbo.");
    expect(clubExperience).toContain("Cada fatia vale um carimbo.");
    expect(clubExperience).toContain("Junte 14 carimbos e ganhe uma fatia tradicional.");
    expect(memberArea).toContain("Seu cartão");
    expect(memberArea).toContain("Meus carimbos");
    expect(memberArea).toContain("Minha Fatia Grátis");
  });

  it("mantém 14 espaços visuais e o texto completo de Como funciona", () => {
    expect(memberArea).toContain("Array.from({ length: 14 }");
    expect(memberArea).toContain("A cada fatia comprada, você recebe um carimbo no seu Cartão Clube");
    expect(memberArea).toContain("Cada fatia comprada, tradicional ou premium, vale 1 carimbo.");
  });
});

describe("Código do Membro", () => {
  it("cria um código anual, sequencial, único e imutável", () => {
    expect(migration).toContain("'ADOC ' || joined_year::text");
    expect(migration).toContain("profiles_member_code_unique unique (member_code)");
    expect(migration).toContain("create trigger profiles_assign_member_code");
    expect(migration).toContain("create trigger profiles_preserve_member_code");
  });
});
