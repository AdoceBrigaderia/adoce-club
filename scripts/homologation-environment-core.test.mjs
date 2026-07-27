import assert from "node:assert/strict";
import test from "node:test";
import {
  extractSupabaseProjectRef,
  validateHomologationEnvironment,
} from "./homologation-environment-core.mjs";

const validEnvironment = {
  ADOCE_DEPLOY_ENV: "homologation",
  CONTEXT: "deploy-preview",
  SITE_URL: "https://homologacao-adoce--adoce-homologacao.netlify.app",
  BFF_ALLOWED_ORIGINS:
    "https://homologacao-adoce--adoce-homologacao.netlify.app",
  PASSKEY_RP_ID: "homologacao-adoce--adoce-homologacao.netlify.app",
  PASSKEY_ALLOWED_ORIGINS:
    "https://homologacao-adoce--adoce-homologacao.netlify.app",
  VITE_SUPABASE_URL: "https://homolog-project.supabase.co",
  SUPABASE_URL: "https://homolog-project.supabase.co",
  ADOCE_HOMOLOGATION_SUPABASE_REF: "homolog-project",
  ADOCE_PRODUCTION_SUPABASE_REF: "production-project",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  SUPABASE_SECRET_KEY: "server-secret",
  WHATSAPP_OTP_PEPPER: "otp-pepper",
  PUBLIC_RATE_LIMIT_PEPPER: "rate-pepper",
};

test("extrai a referência apenas de URLs oficiais Supabase", () => {
  assert.equal(
    extractSupabaseProjectRef("https://abc123.supabase.co"),
    "abc123",
  );
  assert.equal(extractSupabaseProjectRef("https://example.com"), null);
  assert.equal(extractSupabaseProjectRef("not-a-url"), null);
});

test("aprova homologação completamente isolada", () => {
  const result = validateHomologationEnvironment(validEnvironment);
  assert.equal(result.passed, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.checks.bffOriginMatches, true);
  assert.equal(result.checks.passkeyOriginMatches, true);
  assert.equal(result.checks.passkeyRpIdMatches, true);
  assert.equal(result.checks.browserProjectMatches, true);
  assert.equal(result.checks.serverProjectMatches, true);
  assert.equal(result.checks.serverSecretPresent, true);
  assert.equal(result.checks.peppersSeparated, true);
});

test("bloqueia domínio oficial de produção", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    SITE_URL: "https://www.adocebrigaderia.com.br",
    BFF_ALLOWED_ORIGINS: "https://www.adocebrigaderia.com.br",
    PASSKEY_ALLOWED_ORIGINS: "https://www.adocebrigaderia.com.br",
    PASSKEY_RP_ID: "www.adocebrigaderia.com.br",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("SITE_URL")));
});

test("bloqueia SITE_URL com caminho, parâmetros ou fragmento", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    SITE_URL:
      "https://homologacao-adoce--adoce-homologacao.netlify.app/preview?x=1#teste",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("sem caminho")));
});

test("bloqueia origens BFF e passkey divergentes", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    BFF_ALLOWED_ORIGINS: "https://outro-site.netlify.app",
    PASSKEY_ALLOWED_ORIGINS: "https://outro-site.netlify.app",
    PASSKEY_RP_ID: "outro-site.netlify.app",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("BFF_ALLOWED_ORIGINS")));
  assert.ok(
    result.errors.some((error) => error.includes("PASSKEY_ALLOWED_ORIGINS")),
  );
  assert.ok(result.errors.some((error) => error.includes("PASSKEY_RP_ID")));
});

test("bloqueia frontend apontando para projeto diferente", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    VITE_SUPABASE_URL: "https://other-project.supabase.co",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("frontend")));
  assert.ok(result.errors.some((error) => error.includes("diferentes")));
});

test("bloqueia referência explícita de produção", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    VITE_SUPABASE_URL: "https://production-project.supabase.co",
    SUPABASE_URL: "https://production-project.supabase.co",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("produção")));
});

test("bloqueia chave secreta exposta ao Vite", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_do_not_expose",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("chave secreta")));
});

test("bloqueia núcleo sem segredo server-only ou peppers", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    SUPABASE_SECRET_KEY: "",
    WHATSAPP_OTP_PEPPER: "",
    PUBLIC_RATE_LIMIT_PEPPER: "",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("SUPABASE_SECRET_KEY")));
  assert.ok(result.errors.some((error) => error.includes("WHATSAPP_OTP_PEPPER")));
  assert.ok(
    result.errors.some((error) => error.includes("PUBLIC_RATE_LIMIT_PEPPER")),
  );
});

test("bloqueia reutilização do mesmo pepper", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    PUBLIC_RATE_LIMIT_PEPPER: validEnvironment.WHATSAPP_OTP_PEPPER,
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("devem ser valores distintos")));
});

test("bloqueia contexto de produção mesmo com alias de homologação", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    CONTEXT: "production",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("Netlify")));
});
