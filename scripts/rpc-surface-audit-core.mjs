import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RPC_NAME = /^[a-z][a-z0-9_]*$/;
const ACTIVE_CATEGORIES = [
  "operationBff",
  "clientBff",
  "dedicatedAuthenticated",
  "publicCompatibilityAuthenticated",
];

function addViolation(violations, code, detail, file = null) {
  violations.push({ code, detail, file });
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function parseTsArray(source, name) {
  const match = source.match(
    new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`),
  );
  if (!match) return null;
  return [...match[1].matchAll(/"([a-z0-9_]+)"/g)].map((item) => item[1]);
}

function parseSqlArray(source, name) {
  const match = source.match(
    new RegExp(`${name} text\\[\\] := array\\[([\\s\\S]*?)\\];`),
  );
  if (!match) return null;
  return [...match[1].matchAll(/'([a-z0-9_]+)'/g)].map((item) => item[1]);
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function diffArrays(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    missing: expected.filter((value) => !actualSet.has(value)),
    unexpected: actual.filter((value) => !expectedSet.has(value)),
    reordered: expected.length === actual.length && !arraysEqual(expected, actual),
  };
}

function validateStringArray(manifest, name, violations) {
  const value = manifest[name];
  if (!Array.isArray(value)) {
    addViolation(violations, "manifest_category_missing", `${name} deve ser um array`, "security/rpc-surface.json");
    return [];
  }
  const invalid = value.filter((item) => typeof item !== "string" || !RPC_NAME.test(item));
  if (invalid.length > 0) {
    addViolation(
      violations,
      "manifest_rpc_name_invalid",
      `${name} contém nomes inválidos: ${invalid.join(", ")}`,
      "security/rpc-surface.json",
    );
  }
  const duplicates = duplicateValues(value);
  if (duplicates.length > 0) {
    addViolation(
      violations,
      "manifest_category_duplicates",
      `${name} contém duplicidades: ${duplicates.join(", ")}`,
      "security/rpc-surface.json",
    );
  }
  return value.filter((item) => typeof item === "string");
}

function validateExactArray(expected, actual, code, label, file, violations) {
  if (!actual) {
    addViolation(violations, `${code}_missing`, `${label} não foi encontrada`, file);
    return;
  }
  if (arraysEqual(expected, actual)) return;
  const diff = diffArrays(expected, actual);
  addViolation(
    violations,
    code,
    `${label} divergiu; ausentes=[${diff.missing.join(", ")}], inesperadas=[${diff.unexpected.join(", ")}], ordem_alterada=${diff.reordered}`,
    file,
  );
}

export function auditRpcSurface(repositoryRoot) {
  const manifestPath = resolve(repositoryRoot, "security/rpc-surface.json");
  const policyPath = resolve(repositoryRoot, "netlify/functions/_shared/bff-rpc-policy.ts");
  const livePath = resolve(repositoryRoot, "supabase/tests/authenticated_rpc_allowlist_live.sql");
  const migrationPath = resolve(
    repositoryRoot,
    "supabase/migrations/20260729120500_lock_superseded_rpc_versions.sql",
  );

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const policy = readFileSync(policyPath, "utf8");
  const liveAllowlist = readFileSync(livePath, "utf8");
  const supersededMigration = readFileSync(migrationPath, "utf8");
  const violations = [];

  if (manifest.schemaVersion !== 1) {
    addViolation(
      violations,
      "manifest_schema_unsupported",
      `schemaVersion esperado=1, recebido=${String(manifest.schemaVersion)}`,
      "security/rpc-surface.json",
    );
  }

  const categories = Object.fromEntries(
    ACTIVE_CATEGORIES.map((name) => [name, validateStringArray(manifest, name, violations)]),
  );
  const anonymous = validateStringArray(manifest, "anonymous", violations);
  const active = ACTIVE_CATEGORIES.flatMap((name) => categories[name]);
  const crossCategoryDuplicates = duplicateValues(active);
  if (crossCategoryDuplicates.length > 0) {
    addViolation(
      violations,
      "manifest_cross_category_duplicates",
      `RPCs aparecem em mais de uma categoria autenticada: ${crossCategoryDuplicates.join(", ")}`,
      "security/rpc-surface.json",
    );
  }

  const publicCompatibility = new Set(categories.publicCompatibilityAuthenticated);
  const anonymousOutsideCompatibility = anonymous.filter((rpc) => !publicCompatibility.has(rpc));
  if (anonymousOutsideCompatibility.length > 0) {
    addViolation(
      violations,
      "anonymous_outside_public_compatibility",
      `RPCs anônimas não pertencem à categoria pública compatível: ${anonymousOutsideCompatibility.join(", ")}`,
      "security/rpc-surface.json",
    );
  }

  const transactionVersions = Array.isArray(manifest.transactionVersions)
    ? manifest.transactionVersions
    : [];
  if (!Array.isArray(manifest.transactionVersions)) {
    addViolation(
      violations,
      "transaction_versions_missing",
      "transactionVersions deve ser um array",
      "security/rpc-surface.json",
    );
  }
  const activeSet = new Set(active);
  const versionNames = [];
  for (const pair of transactionVersions) {
    const superseded = pair?.superseded;
    const current = pair?.current;
    if (!RPC_NAME.test(superseded || "") || !RPC_NAME.test(current || "")) {
      addViolation(
        violations,
        "transaction_version_invalid",
        `par inválido: ${JSON.stringify(pair)}`,
        "security/rpc-surface.json",
      );
      continue;
    }
    versionNames.push(superseded, current);
    if (activeSet.has(superseded)) {
      addViolation(
        violations,
        "superseded_rpc_active",
        `${superseded} continua na superfície autenticada`,
        "security/rpc-surface.json",
      );
    }
    if (!activeSet.has(current)) {
      addViolation(
        violations,
        "current_rpc_missing",
        `${current} não está na superfície autenticada`,
        "security/rpc-surface.json",
      );
    }
    for (const rpc of [superseded, current]) {
      if (!supersededMigration.includes(`'${rpc}'`)) {
        addViolation(
          violations,
          "transaction_version_not_wired",
          `${rpc} não aparece na migration de bloqueio de versões`,
          "supabase/migrations/20260729120500_lock_superseded_rpc_versions.sql",
        );
      }
    }
  }
  const versionDuplicates = duplicateValues(versionNames);
  if (versionDuplicates.length > 0) {
    addViolation(
      violations,
      "transaction_version_duplicates",
      `versões repetidas no manifesto: ${versionDuplicates.join(", ")}`,
      "security/rpc-surface.json",
    );
  }

  validateExactArray(
    categories.operationBff,
    parseTsArray(policy, "OPERATION_RPC_ALLOWLIST"),
    "operation_policy_drift",
    "OPERATION_RPC_ALLOWLIST",
    "netlify/functions/_shared/bff-rpc-policy.ts",
    violations,
  );
  validateExactArray(
    categories.clientBff,
    parseTsArray(policy, "CLIENT_RPC_ALLOWLIST"),
    "client_policy_drift",
    "CLIENT_RPC_ALLOWLIST",
    "netlify/functions/_shared/bff-rpc-policy.ts",
    violations,
  );
  validateExactArray(
    active,
    parseSqlArray(liveAllowlist, "allowed"),
    "authenticated_live_allowlist_drift",
    "allowed",
    "supabase/tests/authenticated_rpc_allowlist_live.sql",
    violations,
  );
  validateExactArray(
    anonymous,
    parseSqlArray(liveAllowlist, "allowed_anon"),
    "anonymous_live_allowlist_drift",
    "allowed_anon",
    "supabase/tests/authenticated_rpc_allowlist_live.sql",
    violations,
  );

  const liveRequirements = [
    "from unnest(allowed) expected_name",
    "Unexpected authenticated SECURITY DEFINER RPCs",
    "Expected authenticated RPCs missing from the controlled surface",
    "Unexpected anonymous SECURITY DEFINER RPCs",
  ];
  for (const requirement of liveRequirements) {
    if (!liveAllowlist.includes(requirement)) {
      addViolation(
        violations,
        "live_allowlist_fail_closed_missing",
        `ensaio vivo perdeu o contrato: ${requirement}`,
        "supabase/tests/authenticated_rpc_allowlist_live.sql",
      );
    }
  }

  const migrationRequirements = [
    "revoke all on function %I.%I(%s) from public, anon, authenticated",
    "grant execute on function %I.%I(%s) to service_role",
    "Superseded RPC versions remain exposed to browser roles",
  ];
  for (const requirement of migrationRequirements) {
    if (!supersededMigration.includes(requirement)) {
      addViolation(
        violations,
        "superseded_migration_fail_closed_missing",
        `migration perdeu o contrato: ${requirement}`,
        "supabase/migrations/20260729120500_lock_superseded_rpc_versions.sql",
      );
    }
  }

  return {
    schemaVersion: manifest.schemaVersion,
    operationBffCount: categories.operationBff.length,
    clientBffCount: categories.clientBff.length,
    dedicatedAuthenticatedCount: categories.dedicatedAuthenticated.length,
    publicCompatibilityAuthenticatedCount: categories.publicCompatibilityAuthenticated.length,
    authenticatedCount: active.length,
    anonymousCount: anonymous.length,
    transactionVersionPairCount: transactionVersions.length,
    violations,
  };
}

export function assertRpcSurface(repositoryRoot) {
  const result = auditRpcSurface(repositoryRoot);
  if (result.violations.length > 0) {
    const details = result.violations
      .map(({ file, code, detail }) => `- ${file || "manifesto"}: ${code} — ${detail}`)
      .join("\n");
    throw new Error(`Auditoria da superfície RPC reprovada:\n${details}`);
  }
  return result;
}
