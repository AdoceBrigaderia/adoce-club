import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateHomologationEnvironment } from "./homologation-environment-core.mjs";

const META_REQUIRED = [
  "META_WA_ACCESS_TOKEN",
  "META_WA_PHONE_NUMBER_ID",
  "META_WA_WABA_ID",
  "META_WA_APP_SECRET",
  "META_WA_VERIFY_TOKEN",
  "META_WA_AUTH_TEMPLATE_NAME",
  "META_WA_GRAPH_API_VERSION",
];

const WALLET_REQUIRED = [
  "GOOGLE_WALLET_ISSUER_ID",
  "GOOGLE_WALLET_CLASS_ID",
  "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_WALLET_PRIVATE_KEY",
  "GOOGLE_WALLET_ORIGINS",
];

const CORE_SECRET_NAMES = [
  "SUPABASE_SECRET_KEY",
  "WHATSAPP_OTP_PEPPER",
  "PUBLIC_RATE_LIMIT_PEPPER",
];

const normalized = (value) => String(value || "").trim();
const missingNames = (environment, names) =>
  names.filter((name) => !normalized(environment[name]));

function integrationStatus(environment, required) {
  const missing = missingNames(environment, required);
  return { configured: missing.length === 0, missing };
}

function deploymentStatus(environment) {
  const missing = [];
  if (!normalized(environment.NETLIFY_SITE_ID || environment.NETLIFY_HOMOLOGATION_SITE_ID)) {
    missing.push("NETLIFY_HOMOLOGATION_SITE_ID");
  }
  if (!normalized(environment.NETLIFY_AUTH_TOKEN)) missing.push("NETLIFY_AUTH_TOKEN");
  return { configured: missing.length === 0, missing };
}

function safeBranch(environment) {
  return (
    normalized(
      environment.GITHUB_REF_NAME || environment.BRANCH || environment.HEAD,
    ) || null
  );
}

function safeCommit(environment) {
  const value = normalized(
    environment.GITHUB_SHA ||
      environment.COMMIT_REF ||
      environment.ADOCE_PREFLIGHT_COMMIT,
  );
  return /^[0-9a-f]{7,40}$/i.test(value) ? value : null;
}

export function buildHomologationPreflightReport(environment, options = {}) {
  const core = validateHomologationEnvironment(environment);
  const meta = integrationStatus(environment, META_REQUIRED);
  const wallet = integrationStatus(environment, WALLET_REQUIRED);
  const deploy = deploymentStatus(environment);
  const coreSecrets = integrationStatus(environment, CORE_SECRET_NAMES);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const previewPublishReady = core.passed && deploy.configured;
  const fullIntegrationReady =
    previewPublishReady && meta.configured && wallet.configured;

  return {
    schemaVersion: 1,
    generatedAt,
    environment: normalized(environment.ADOCE_DEPLOY_ENV) || null,
    branch: safeBranch(environment),
    commit: safeCommit(environment),
    summary: {
      coreReady: core.passed,
      previewPublishReady,
      fullIntegrationReady,
    },
    core: {
      passed: core.passed,
      errors: [...core.errors],
      warnings: [...core.warnings],
      checks: { ...core.checks },
      missingSecretNames: coreSecrets.missing,
    },
    deployment: deploy,
    integrations: {
      metaWhatsApp: meta,
      googleWallet: wallet,
    },
  };
}

export function renderHomologationPreflightMarkdown(report) {
  const mark = (ready) => (ready ? "✅" : "❌");
  const lines = [
    "# Pré-flight da homologação do Portal Adoce",
    "",
    `Gerado em: ${report.generatedAt}`,
    `Branch: ${report.branch || "não identificada"}`,
    `Commit: ${report.commit || "não identificado"}`,
    "",
    "## Resumo",
    "",
    `- ${mark(report.summary.coreReady)} Núcleo da aplicação pronto`,
    `- ${mark(report.summary.previewPublishReady)} Preview pronto para publicação`,
    `- ${mark(report.summary.fullIntegrationReady)} Meta WhatsApp e Google Wallet completos`,
    "",
  ];

  if (report.core.errors.length) {
    lines.push(
      "## Bloqueios do núcleo",
      "",
      ...report.core.errors.map((item) => `- ${item}`),
      "",
    );
  }

  if (report.core.warnings.length) {
    lines.push(
      "## Alertas",
      "",
      ...report.core.warnings.map((item) => `- ${item}`),
      "",
    );
  }

  const sections = [
    ["Infraestrutura de deploy", report.deployment],
    ["Meta WhatsApp Cloud API", report.integrations.metaWhatsApp],
    ["Google Wallet", report.integrations.googleWallet],
  ];

  for (const [title, status] of sections) {
    lines.push(
      `## ${title}`,
      "",
      status.configured ? "- Configuração completa." : "- Variáveis ausentes:",
    );
    if (!status.configured) {
      lines.push(...status.missing.map((name) => `  - \`${name}\``));
    }
    lines.push("");
  }

  lines.push(
    "## Segurança do relatório",
    "",
    "Este arquivo registra somente estados booleanos e nomes de variáveis ausentes. Valores de tokens, chaves, peppers e credenciais nunca são incluídos.",
    "",
  );

  return `${lines.join("\n")}\n`;
}

export function writeHomologationPreflightArtifacts(
  report,
  outputDirectory = "artifacts",
) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const jsonPath = path.join(
    outputDirectory,
    "homologation-preflight.json",
  );
  const markdownPath = path.join(
    outputDirectory,
    "homologation-preflight.md",
  );
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    markdownPath,
    renderHomologationPreflightMarkdown(report),
    "utf8",
  );
  return { jsonPath, markdownPath };
}

function isMainModule() {
  return (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  const report = buildHomologationPreflightReport(process.env);
  const paths = writeHomologationPreflightArtifacts(report);
  console.log(
    `Pré-flight salvo em ${paths.jsonPath} e ${paths.markdownPath}.`,
  );
  console.log(
    `Núcleo: ${report.summary.coreReady ? "pronto" : "bloqueado"}.`,
  );
  console.log(
    `Preview: ${report.summary.previewPublishReady ? "pronto" : "bloqueado"}.`,
  );
  if (!report.summary.coreReady) process.exitCode = 1;
}
