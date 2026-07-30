import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildHomologationPreflightReport,
  renderHomologationPreflightMarkdown,
  writeHomologationPreflightArtifacts,
} from "./homologation-preflight-report.mjs";

const validEnvironment = () => ({
  ADOCE_DEPLOY_ENV: "homologation",
  CONTEXT: "branch-deploy",
  SITE_URL: "https://homologacao-adoce--adoce-homologacao.netlify.app",
  BFF_ALLOWED_ORIGINS:
    "https://homologacao-adoce--adoce-homologacao.netlify.app",
  PASSKEY_ALLOWED_ORIGINS:
    "https://homologacao-adoce--adoce-homologacao.netlify.app",
  PASSKEY_RP_ID: "homologacao-adoce--adoce-homologacao.netlify.app",
  ADOCE_HOMOLOGATION_SUPABASE_REF: "homologacao123",
  ADOCE_PRODUCTION_SUPABASE_REF: "producao456",
  VITE_SUPABASE_URL: "https://homologacao123.supabase.co",
  SUPABASE_URL: "https://homologacao123.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SECRET_KEY: "sb_secret_nao_expor",
  WHATSAPP_OTP_PEPPER: "pepper-otp-separado",
  PUBLIC_RATE_LIMIT_PEPPER: "pepper-rate-separado",
  NETLIFY_HOMOLOGATION_SITE_ID: "site-homologacao",
  NETLIFY_AUTH_TOKEN: "token-netlify-nao-expor",
  META_WA_ACCESS_TOKEN: "token-meta-nao-expor",
  META_WA_PHONE_NUMBER_ID: "123",
  META_WA_WABA_ID: "456",
  META_WA_APP_SECRET: "segredo-meta-nao-expor",
  META_WA_VERIFY_TOKEN: "verify-nao-expor",
  META_WA_AUTH_TEMPLATE_NAME: "adoce_otp",
  META_WA_GRAPH_API_VERSION: "v23.0",
  GOOGLE_WALLET_ISSUER_ID: "issuer",
  GOOGLE_WALLET_CLASS_ID: "class",
  GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL:
    "wallet@example.iam.gserviceaccount.com",
  GOOGLE_WALLET_PRIVATE_KEY: "chave-wallet-nao-expor",
  GOOGLE_WALLET_ORIGINS:
    "https://homologacao-adoce--adoce-homologacao.netlify.app",
  GITHUB_REF_NAME: "reestruturacao/ux-crm-operacao-imagens-v1",
  GITHUB_SHA: "1234567890abcdef1234567890abcdef12345678",
});

test("relatório pronto não expõe valores secretos", () => {
  const environment = validEnvironment();
  const report = buildHomologationPreflightReport(environment, {
    generatedAt: "2026-07-27T13:00:00.000Z",
  });

  assert.equal(report.summary.coreReady, true);
  assert.equal(report.summary.previewPublishReady, true);
  assert.equal(report.summary.fullIntegrationReady, true);

  const serialized = JSON.stringify(report);
  for (const secret of [
    environment.SUPABASE_SECRET_KEY,
    environment.WHATSAPP_OTP_PEPPER,
    environment.PUBLIC_RATE_LIMIT_PEPPER,
    environment.NETLIFY_AUTH_TOKEN,
    environment.META_WA_ACCESS_TOKEN,
    environment.META_WA_APP_SECRET,
    environment.META_WA_VERIFY_TOKEN,
    environment.GOOGLE_WALLET_PRIVATE_KEY,
  ]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("integrações ausentes não bloqueiam o núcleo nem o preview", () => {
  const environment = validEnvironment();
  for (const name of Object.keys(environment)) {
    if (
      name.startsWith("META_WA_") ||
      name.startsWith("GOOGLE_WALLET_")
    ) {
      delete environment[name];
    }
  }

  const report = buildHomologationPreflightReport(environment);
  assert.equal(report.summary.coreReady, true);
  assert.equal(report.summary.previewPublishReady, true);
  assert.equal(report.summary.fullIntegrationReady, false);
  assert.ok(
    report.integrations.metaWhatsApp.missing.includes(
      "META_WA_ACCESS_TOKEN",
    ),
  );
  assert.ok(
    report.integrations.googleWallet.missing.includes(
      "GOOGLE_WALLET_PRIVATE_KEY",
    ),
  );
});

test("segredo obrigatório ausente bloqueia núcleo e informa somente o nome", () => {
  const environment = validEnvironment();
  delete environment.PUBLIC_RATE_LIMIT_PEPPER;

  const report = buildHomologationPreflightReport(environment);
  assert.equal(report.summary.coreReady, false);
  assert.equal(report.summary.previewPublishReady, false);
  assert.deepEqual(report.core.missingSecretNames, [
    "PUBLIC_RATE_LIMIT_PEPPER",
  ]);

  const markdown = renderHomologationPreflightMarkdown(report);
  assert.match(markdown, /PUBLIC_RATE_LIMIT_PEPPER/);
  assert.doesNotMatch(markdown, /pepper-otp-separado/);
});

test("artefatos JSON e Markdown são gravados com conteúdo redigido", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "adoce-preflight-"),
  );
  const report = buildHomologationPreflightReport(validEnvironment(), {
    generatedAt: "2026-07-27T13:00:00.000Z",
  });

  const paths = writeHomologationPreflightArtifacts(report, directory);
  assert.equal(fs.existsSync(paths.jsonPath), true);
  assert.equal(fs.existsSync(paths.markdownPath), true);

  const contents = fs.readFileSync(paths.markdownPath, "utf8");
  assert.match(contents, /Núcleo da aplicação pronto/);
  assert.doesNotMatch(contents, /token-meta-nao-expor/);
});
