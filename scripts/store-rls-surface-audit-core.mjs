import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TABLE_NAME = /^[a-z][a-z0-9_]*$/;
const SAFE_REPOSITORY_PATH = /^(security|supabase|\.github)\/[a-zA-Z0-9_./-]+$/;

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

function parseSqlArray(source, name) {
  const match = source.match(
    new RegExp(`${name} text\\[\\] := array\\[([\\s\\S]*?)\\];`),
  );
  if (!match) return null;
  return [...match[1].matchAll(/'([a-z0-9_]+)'/g)].map((item) => item[1]);
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

function validateRepositoryPath(value, label, violations) {
  if (typeof value !== "string" || !SAFE_REPOSITORY_PATH.test(value) || value.includes("..")) {
    addViolation(
      violations,
      "manifest_path_invalid",
      `${label} possui caminho inválido: ${String(value)}`,
      "security/store-rls-surface.json",
    );
    return null;
  }
  return value;
}

function validateTables(manifest, violations) {
  if (!Array.isArray(manifest.tables)) {
    addViolation(
      violations,
      "manifest_tables_missing",
      "tables deve ser um array",
      "security/store-rls-surface.json",
    );
    return [];
  }

  const tables = [];
  for (const entry of manifest.tables) {
    const name = entry?.name;
    const predicates = entry?.readPredicates;
    if (typeof name !== "string" || !TABLE_NAME.test(name)) {
      addViolation(
        violations,
        "manifest_table_name_invalid",
        `nome de tabela inválido: ${String(name)}`,
        "security/store-rls-surface.json",
      );
      continue;
    }
    if (!Array.isArray(predicates) || predicates.length === 0) {
      addViolation(
        violations,
        "manifest_predicates_missing",
        `${name} deve possuir ao menos um predicado de leitura`,
        "security/store-rls-surface.json",
      );
      tables.push({ name, readPredicates: [] });
      continue;
    }
    const validPredicates = predicates.filter(
      (predicate) => typeof predicate === "string" && predicate.trim().length > 0,
    );
    if (validPredicates.length !== predicates.length) {
      addViolation(
        violations,
        "manifest_predicate_invalid",
        `${name} contém predicado vazio ou inválido`,
        "security/store-rls-surface.json",
      );
    }
    const duplicates = duplicateValues(validPredicates);
    if (duplicates.length > 0) {
      addViolation(
        violations,
        "manifest_predicate_duplicates",
        `${name} contém predicados duplicados: ${duplicates.join(", ")}`,
        "security/store-rls-surface.json",
      );
    }
    tables.push({ name, readPredicates: validPredicates });
  }

  const duplicates = duplicateValues(tables.map(({ name }) => name));
  if (duplicates.length > 0) {
    addViolation(
      violations,
      "manifest_table_duplicates",
      `tabelas duplicadas: ${duplicates.join(", ")}`,
      "security/store-rls-surface.json",
    );
  }
  return tables;
}

function predicateCaseBlock(source, tableName) {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(
    new RegExp(`when '${escaped}' then([\\s\\S]*?)(?=\\n\\s*when '|\\n\\s*else )`),
  );
  return match?.[1] || null;
}

function requireTokens(source, requirements, code, file, violations) {
  for (const requirement of requirements) {
    if (!source.includes(requirement)) {
      addViolation(
        violations,
        code,
        `contrato ausente: ${requirement}`,
        file,
      );
    }
  }
}

export function auditStoreRlsSurface(repositoryRoot) {
  const manifestFile = "security/store-rls-surface.json";
  const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, manifestFile), "utf8"));
  const violations = [];

  if (manifest.schemaVersion !== 1) {
    addViolation(
      violations,
      "manifest_schema_unsupported",
      `schemaVersion esperado=1, recebido=${String(manifest.schemaVersion)}`,
      manifestFile,
    );
  }

  const liveTestFile = validateRepositoryPath(manifest.liveTest, "liveTest", violations);
  const migrationFile = validateRepositoryPath(
    manifest.writeLockMigration,
    "writeLockMigration",
    violations,
  );
  const workflowFile = validateRepositoryPath(manifest.workflow, "workflow", violations);
  const tables = validateTables(manifest, violations);
  const tableNames = tables.map(({ name }) => name);
  const predicateCount = tables.reduce(
    (total, { readPredicates }) => total + readPredicates.length,
    0,
  );

  if (!liveTestFile || !migrationFile || !workflowFile) {
    return {
      schemaVersion: manifest.schemaVersion,
      tableCount: tableNames.length,
      predicateCount,
      violations,
    };
  }

  const liveTest = readFileSync(resolve(repositoryRoot, liveTestFile), "utf8");
  const migration = readFileSync(resolve(repositoryRoot, migrationFile), "utf8");
  const workflow = readFileSync(resolve(repositoryRoot, workflowFile), "utf8");

  validateExactArray(
    tableNames,
    parseSqlArray(liveTest, "required_tables"),
    "live_table_inventory_drift",
    "required_tables",
    liveTestFile,
    violations,
  );
  validateExactArray(
    tableNames,
    parseSqlArray(migration, "locked_tables"),
    "migration_table_inventory_drift",
    "locked_tables",
    migrationFile,
    violations,
  );

  for (const { name, readPredicates } of tables) {
    const block = predicateCaseBlock(liveTest, name);
    if (!block) {
      addViolation(
        violations,
        "live_predicate_case_missing",
        `case de leitura ausente para ${name}`,
        liveTestFile,
      );
      continue;
    }
    for (const predicate of readPredicates) {
      if (!block.includes(`position('${predicate}'`)) {
        addViolation(
          violations,
          "live_read_predicate_missing",
          `${name} perdeu o predicado ${predicate}`,
          liveTestFile,
        );
      }
    }
  }

  requireTokens(
    liveTest,
    [
      "not class.relrowsecurity",
      "has_table_privilege('anon'",
      "has_table_privilege('authenticated'",
      "Direct authenticated writes bypass the RPC boundary",
      "Anonymous RLS policies found inside the store boundary",
      "authenticated_write_policies",
      "Authenticated write policies remain inside the RPC-only store boundary",
      "missing_read_policies",
      "weak_read_policies",
      "dangerous_read_policies",
      "policy.qual is null",
      "lower(btrim(policy.qual)) in ('true', '(true)')",
      "Tautological or empty store read policies detected",
      "begin;",
      "rollback;",
    ],
    "live_fail_closed_contract_missing",
    liveTestFile,
    violations,
  );

  requireTokens(
    migration,
    [
      "revoke insert, update, delete, truncate on table",
      "from public, anon, authenticated",
      "drop policy if exists stores_manager_insert",
      "drop policy if exists stores_manager_update",
      "drop policy if exists cash_registers_manager_insert",
      "drop policy if exists cash_registers_manager_update",
      "drop policy if exists staff_store_assignments_manager_all",
      "has_table_privilege(role_name",
      "role_name::text in ('public', 'anon', 'authenticated')",
      "Store-scoped tables still expose direct browser writes",
      "Store-scoped browser write policies remain after lockdown",
      "begin;",
      "commit;",
    ],
    "write_lock_migration_contract_missing",
    migrationFile,
    violations,
  );

  requireTokens(
    workflow,
    [
      "workflow_dispatch:",
      "EXPECTED_BRANCH: reestruturacao/ux-crm-operacao-imagens-v1",
      'test "$CONFIRMATION" = "AUDITAR RLS SOMENTE HOMOLOGACAO $HOMOLOGATION_REF"',
      "SUPABASE_HOMOLOGATION_DB_URL",
      "ADOCE_HOMOLOGATION_SUPABASE_REF",
      "ADOCE_PRODUCTION_SUPABASE_REF",
      liveTestFile,
      "Referência de produção detectada e bloqueada",
      "psql \"$SUPABASE_HOMOLOGATION_DB_URL\"",
    ],
    "workflow_contract_missing",
    workflowFile,
    violations,
  );

  if (/^\s*push:/m.test(workflow)) {
    addViolation(
      violations,
      "workflow_automatic_trigger_forbidden",
      "workflow vivo não pode executar em push",
      workflowFile,
    );
  }
  for (const forbidden of ["netlify deploy", "supabase db push", "supabase migration up"]) {
    if (workflow.includes(forbidden)) {
      addViolation(
        violations,
        "workflow_mutation_forbidden",
        `workflow vivo contém comando proibido: ${forbidden}`,
        workflowFile,
      );
    }
  }

  return {
    schemaVersion: manifest.schemaVersion,
    tableCount: tableNames.length,
    predicateCount,
    violations,
  };
}

export function assertStoreRlsSurface(repositoryRoot) {
  const result = auditStoreRlsSurface(repositoryRoot);
  if (result.violations.length > 0) {
    const details = result.violations
      .map(({ file, code, detail }) => `- ${file || "manifesto"}: ${code} — ${detail}`)
      .join("\n");
    throw new Error(`Auditoria da superfície RLS por loja reprovada:\n${details}`);
  }
  return result;
}
