import assert from "node:assert/strict";
import test from "node:test";
import {
  extractSupabaseProjectRef,
  validateHomologationEnvironment,
} from "./homologation-environment-core.mjs";

const homologationOrigin =
  "https://homologacao-adoce--adoce-homologacao.netlify.app";

const validEnvironment = {
  ADOCE_DEPLOY_ENV: "homologation",
  CONTEXT: "deploy-preview",
  SITE_URL: homologationOrigin,
  BFF_ALLOWED_ORIGINS: homologationOrigin,
  PASSKEY_RP_ID: "homologacao-adoce--adoce-homologacao.netlify.app",
  PASSKEY_ALLOWED_ORIGINS: homologationOrigin,
  GOOGLE_WALLET_ORIGINS: homologationOrigin,
  META_WA_ENVIRONMENT: "homologation",
  META_WA_GRAPH_API_VERSION: "v23.0",
  VITE_SUPABASE_URL: "https://homolog-project.supabase.co",
  SUPABASE_URL: "https://homolog-project.supabase.co",
  ADOCE_HOMOLOGATION_SUPABASE_REF: "homolog-project",
  ADOCE_PRODUCTION_SUPABASE_REF: "production-project",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  SUPABASE_SECRET_KEY: "server-secret",
  WHATSAPP_OTP_PEPPER: "otp-pepper",
  PUBLIC_RATE_LIMIT_PEPPER: "rate-pepper",
};

const configuredMeta = {
  META_WA_ACCESS_TOKEN: "token-test",
  META_WA_PHONE_NUMBER_ID: "123456789",
  META_WA_WABA_ID: "987654321",
  META_WA_APP_SECRET: "app-secret-test",
  META_WA_VERIFY_TOKEN: "verify-token-test",
  META_WA_AUTH_TEMPLATE_NAME: "adoce_auth_test",
};

const configuredWallet = {
  GOOGLE_WALLET_ISSUER_ID: "1234567890",
  GOOGLE_WALLET_CLASS_ID: "adoce_test",
  GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "wallet@example.test",
  GOOGLE_WALLET_PRIVATE_KEY: "private-key-test",
};

test("extrai a referência apenas de URLs oficiais Supabase", () => {
  assert.equal(
    extractSupabaseProjectRef("https://abc123.supabase.co"),
    "abc123",
  );
  assert.equal(extractSupabaseProjectRef("https://example.com"), null);
  assert.equal(extractSupabaseProjectRef("not-a-url"), null);
});

test("aprova homologação isolada sem bloquear integrações externas ausentes", () => {
  const result = validateHomologationEnvironment(validEnvironment);
  assert.equal(result.passed, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.checks.bffOriginMatches, true);
  assert.equal(result.checks.bffOriginsSafe, true);
  assert.equal(result.checks.passkeyOriginMatches, true);
  assert.equal(result.checks.passkeyOriginsSafe, true);
  assert.equal(result.checks.passkeyRpIdMatches, true);
  assert.equal(result.checks.browserProjectMatches, true);
  assert.equal(result.checks.serverProjectMatches, true);
  assert.equal(result.checks.serverSecretPresent, true);
  assert.equal(result.checks.peppersSeparated, true);
  assert.equal(result.checks.metaConfigured, false);
  assert.equal(result.checks.googleWalletConfigured, false);
  assert.ok(result.warnings.some((warning) => warning.includes("Meta WhatsApp")));
  assert.ok(result.warnings.some((warning) => warning.includes("Google Wallet")));
});

test("aprova Meta e Google Wallet completos e alinhados à mesma origem", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    ...configuredMeta,
    ...configuredWallet,
  });
  assert.equal(result.passed, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.checks.metaComplete, true);
  assert.equal(result.checks.metaGraphVersionValid, true);
  assert.equal(result.checks.googleWalletComplete, true);
  assert.equal(result.checks.googleWalletOriginMatches, true);
  assert.equal(result.checks.googleWalletOriginsSafe, true);
});

test("bloqueia domínio oficial de produção", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    SITE_URL: "https://www.adocebrigaderia.com.br",
    BFF_ALLOWED_ORIGINS: "https://www.adocebrigaderia.com.br",
    PASSKEY_ALLOWED_ORIGINS: "https://www.adocebrigaderia.com.br",
    GOOGLE_WALLET_ORIGINS: "https://www.adocebrigaderia.com.br",
    PASSKEY_RP_ID: "www.adocebrigaderia.com.br",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("SITE_URL")));
  assert.ok(result.errors.some((error) => error.includes("BFF_ALLOWED_ORIGINS")));
  assert.ok(result.errors.some((error) => error.includes("PASSKEY_ALLOWED_ORIGINS")));
  assert.ok(result.errors.some((error) => error.includes("GOOGLE_WALLET_ORIGINS")));
});

test("bloqueia produção escondida como origem adicional", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    BFF_ALLOWED_ORIGINS: `${homologationOrigin},https://www.adocebrigaderia.com.br`,
    PASSKEY_ALLOWED_ORIGINS: `${homologationOrigin},https://clube.adocebrigaderia.com.br`,
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("BFF_ALLOWED_ORIGINS")));
  assert.ok(result.errors.some((error) => error.includes("PASSKEY_ALLOWED_ORIGINS")));
});

test("bloqueia SITE_URL com caminho, parâmetros ou fragmento", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    SITE_URL: `${homologationOrigin}/preview?x=1#teste`,
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("sem caminho")));
});

test("bloqueia listas de origem com caminho, HTTP ou valor inválido", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    BFF_ALLOWED_ORIGINS: `${homologationOrigin},https://outro.netlify.app/rota`,
    PASSKEY_ALLOWED_ORIGINS: "http://localhost:5173",
    GOOGLE_WALLET_ORIGINS: "não-é-url",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("BFF_ALLOWED_ORIGINS")));
  assert.ok(result.errors.some((error) => error.includes("PASSKEY_ALLOWED_ORIGINS")));
  assert.ok(result.errors.some((error) => error.includes("GOOGLE_WALLET_ORIGINS")));
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

test("bloqueia Meta parcialmente configurada", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    META_WA_ACCESS_TOKEN: "token-sem-restante",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("parcialmente configurada")));
  assert.ok(result.errors.some((error) => error.includes("META_WA_PHONE_NUMBER_ID")));
});

test("bloqueia ambiente e versão inválidos da Meta", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    ...configuredMeta,
    META_WA_ENVIRONMENT: "production",
    META_WA_GRAPH_API_VERSION: "latest",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("META_WA_ENVIRONMENT")));
  assert.ok(result.errors.some((error) => error.includes("META_WA_GRAPH_API_VERSION")));
});

test("bloqueia Google Wallet parcialmente configurado", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    GOOGLE_WALLET_ISSUER_ID: "1234567890",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("parcialmente configurado")));
  assert.ok(
    result.errors.some((error) =>
      error.includes("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL"),
    ),
  );
});

test("bloqueia Google Wallet completo com origem divergente", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    ...configuredWallet,
    GOOGLE_WALLET_ORIGINS: "https://outro-site.netlify.app",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("GOOGLE_WALLET_ORIGINS")));
});

test("bloqueia contexto de produção mesmo com alias de homologação", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    CONTEXT: "production",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("Netlify")));
});
