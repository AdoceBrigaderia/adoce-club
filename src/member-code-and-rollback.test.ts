import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260718184839_add_member_codes_and_rollback_audit.sql", import.meta.url),
  "utf8",
);
const rollbackFunction = readFileSync(
  new URL("../netlify/functions/production-rollback.ts", import.meta.url),
  "utf8",
);
const memberArea = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const landing = readFileSync(new URL("./MarketingLanding.tsx", import.meta.url), "utf8");

describe("terminologia do Clube Adoce", () => {
  it("mantém os textos principais exatamente como definidos", () => {
    expect(landing).toContain("Faça parte do <em>Clube Adoce</em>");
    expect(landing).toContain("A cada fatia comprada, você recebe um carimbo. Complete 14");
    expect(memberArea).toContain("Área do Membro");
    expect(memberArea).toContain("Cartão do Membro");
    expect(memberArea).toContain("Código do Membro");
    expect(memberArea).toContain("Meus Carimbos");
    expect(memberArea).toContain("Minha Fatia Grátis");
  });

  it("mantém 14 espaços visuais e o texto completo de Como funciona", () => {
    expect(memberArea).toContain("Array.from({ length: 14 }");
    expect(memberArea).toContain("A cada fatia comprada, você recebe um carimbo no seu Cartão Clube");
    expect(memberArea).toContain("O cartão é pessoal e está vinculado ao cadastro do membro.");
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

describe("restauração protegida de produção", () => {
  it("exige proprietário, confirmação e mantém o token fora do navegador", () => {
    expect(rollbackFunction).toContain('staff.role !== "owner"');
    expect(rollbackFunction).toContain('body.confirmation !== "RESTAURAR PRODUCAO"');
    expect(rollbackFunction).toContain('env("NETLIFY_AUTH_TOKEN")');
    expect(rollbackFunction).not.toContain("VITE_NETLIFY_AUTH_TOKEN");
  });

  it("restaura um deploy seguro fixado e registra auditoria", () => {
    expect(rollbackFunction).toContain('env("NETLIFY_SAFE_DEPLOY_ID")');
    expect(rollbackFunction).toContain("/restore`");
    expect(rollbackFunction).toContain("record_owner_production_rollback");
  });
});
