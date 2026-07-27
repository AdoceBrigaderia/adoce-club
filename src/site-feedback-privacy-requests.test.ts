import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./FeedbackPage.tsx", import.meta.url), "utf8");
const legal = readFileSync(new URL("./LegalPage.tsx", import.meta.url), "utf8");
const endpoint = readFileSync(
  new URL("../netlify/functions/public-feedback.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727143000_site_feedback_privacy_requests.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("solicitações de privacidade pela Escuta Adoce", () => {
  it("oferece a opção pública, deep link e exige um canal de retorno", () => {
    expect(page).toContain('value="privacy"');
    expect(page).toContain("Quero falar sobre meus dados e privacidade");
    expect(page).toContain('form.category === "privacy"');
    expect(page).toContain("!form.email.trim() && !form.phone.trim()");
    expect(page).toContain("new URLSearchParams(query)");
    expect(page).toContain('.get("tipo") === "privacy"');
    expect(page).toContain("fallbackContact, fallbackSubject");
  });

  it("liga a política ao formulário protocolado sem remover o e-mail", () => {
    expect(legal).toContain('/#fale-com-a-adoce?tipo=privacy');
    expect(legal).toContain("solicitação de privacidade com protocolo");
    expect(legal).toContain('businessMailto("privacidade"');
  });

  it("valida a categoria e o contato novamente no BFF", () => {
    expect(endpoint).toContain('"privacy"');
    expect(endpoint).toContain('category === "privacy"');
    expect(endpoint).toContain("phoneDigits.length < 10");
    expect(endpoint).toContain("/api/public-feedback");
    expect(endpoint).toContain("consumePublicRateLimits");
  });

  it("mantém a gravação idempotente e roteia sem expor e-mails", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("'privacy'");
    expect(migration).toContain("'business.privacidade'");
    expect(migration).toContain("'business.atendimento'");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).not.toContain("@adocebrigaderia.com.br");
  });

  it("mantém a alteração dentro de uma transação segura", () => {
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
    expect(migration).not.toMatch(/drop table|truncate/i);
  });
});
