import assert from "node:assert/strict";
import test from "node:test";
import {
  extractSupabaseProjectRef,
  validateHomologationEnvironment,
} from "./homologation-environment-core.mjs";

const validEnvironment = {
  ADOCE_DEPLOY_ENV: "homologation",
  CONTEXT: "deploy-preview",
  SITE_URL: "https://homologacao-adoce.netlify.app",
  VITE_SUPABASE_URL: "https://homolog-project.supabase.co",
  SUPABASE_URL: "https://homolog-project.supabase.co",
  ADOCE_HOMOLOGATION_SUPABASE_REF: "homolog-project",
  ADOCE_PRODUCTION_SUPABASE_REF: "production-project",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
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
  assert.equal(result.checks.browserProjectMatches, true);
  assert.equal(result.checks.serverProjectMatches, true);
});

test("bloqueia domínio oficial de produção", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    SITE_URL: "https://www.adocebrigaderia.com.br",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("SITE_URL")));
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

test("bloqueia contexto de produção mesmo com alias de homologação", () => {
  const result = validateHomologationEnvironment({
    ...validEnvironment,
    CONTEXT: "production",
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("Netlify")));
});
