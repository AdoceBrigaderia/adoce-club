import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXTERNAL_SIGNED_ENTRYPOINT = "whatsapp-cloud-webhook.ts";

function addViolation(violations, file, code, detail) {
  violations.push({ file, code, detail });
}

function auditGuardedEntrypoint(file, source, violations) {
  const guardCalls = source.match(/\bguardBffRequest\(/g) || [];
  if (guardCalls.length !== 1) {
    addViolation(
      violations,
      file,
      "bff_guard_count",
      `esperado 1 guardBffRequest, encontrado ${guardCalls.length}`,
    );
  }
  if (!source.includes("./_shared/request-security")) {
    addViolation(
      violations,
      file,
      "bff_guard_import_missing",
      "entrypoint não importa a fronteira compartilhada de requisição",
    );
  }
  if (!/configuredSiteUrl:\s*env\("SITE_URL"\)/.test(source)) {
    addViolation(
      violations,
      file,
      "canonical_origin_missing",
      "entrypoint não vincula o guard à SITE_URL canônica",
    );
  }
  if (/\ballowedOrigin\(/.test(source)) {
    addViolation(
      violations,
      file,
      "local_origin_validation",
      "entrypoint voltou a validar origem fora do guard compartilhado",
    );
  }
  if (/\bvalidCsrf\(/.test(source)) {
    addViolation(
      violations,
      file,
      "local_csrf_validation",
      "entrypoint voltou a validar CSRF fora do guard compartilhado",
    );
  }
}

function auditExternalSignedEntrypoint(file, source, violations) {
  if (/\bguardBffRequest\(/.test(source)) {
    addViolation(
      violations,
      file,
      "external_same_origin_guard",
      "webhook externo não deve depender do guard same-origin do portal",
    );
  }
  const requiredPatterns = [
    ["secure_text_boundary", /\bsecureText\(/],
    ["meta_signature_verification", /\bverifyMetaWebhookSignature\(/],
    ["constant_time_verify_token", /\btimingSafeEqual\(/],
    ["meta_signature_header", /x-hub-signature-256/i],
    ["verification_get", /request\.method\s*===\s*"GET"/],
    ["event_post", /request\.method\s*!==\s*"POST"/],
  ];
  for (const [code, pattern] of requiredPatterns) {
    if (!pattern.test(source)) {
      addViolation(
        violations,
        file,
        code,
        "webhook externo perdeu uma proteção obrigatória",
      );
    }
  }
}

export function auditRequestSecurityInventory(repositoryRoot) {
  const functionsDirectory = resolve(repositoryRoot, "netlify/functions");
  const entrypoints = readdirSync(functionsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => entry.name)
    .sort();
  const violations = [];
  let guardedEntrypoints = 0;
  let externalSignedEntrypoints = 0;

  for (const file of entrypoints) {
    const source = readFileSync(resolve(functionsDirectory, file), "utf8");
    if (file === EXTERNAL_SIGNED_ENTRYPOINT) {
      externalSignedEntrypoints += 1;
      auditExternalSignedEntrypoint(file, source, violations);
      continue;
    }
    guardedEntrypoints += 1;
    auditGuardedEntrypoint(file, source, violations);
  }

  if (!entrypoints.includes(EXTERNAL_SIGNED_ENTRYPOINT)) {
    addViolation(
      violations,
      EXTERNAL_SIGNED_ENTRYPOINT,
      "external_webhook_missing",
      "webhook oficial da Meta não foi encontrado no inventário",
    );
  }

  return {
    entrypoints,
    guardedEntrypoints,
    externalSignedEntrypoints,
    violations,
  };
}

export function assertRequestSecurityInventory(repositoryRoot) {
  const result = auditRequestSecurityInventory(repositoryRoot);
  if (result.violations.length > 0) {
    const details = result.violations
      .map(
        ({ file, code, detail }) =>
          `- ${file}: ${code} — ${detail}`,
      )
      .join("\n");
    throw new Error(`Inventário de segurança das Functions reprovado:\n${details}`);
  }
  return result;
}
