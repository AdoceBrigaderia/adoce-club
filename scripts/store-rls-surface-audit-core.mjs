import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TABLE_NAME = /^[a-z][a-z0-9_]*$/;
const POLICY_NAME = /^[a-z][a-z0-9_]*$/;
const SAFE_REPOSITORY_PATH = /^(security|supabase|\.github)\/[a-zA-Z0-9_./-]+$/;
const ACCESS_MODES = new Set(["authenticated_read", "rpc_only"]);
const MANIFEST_FILE = "security/store-rls-surface.json";

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
  const match = source.match(new RegExp(`${name} text\\[\\] := array\\[([\\s\\S]*?)\\];`));
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

function validateRepositoryPath(value, label, violations, file = MANIFEST_FILE) {
  if (typeof value !== "string" || !SAFE_REPOSITORY_PATH.test(value) || value.includes("..")) {
    addViolation(violations, "manifest_path_invalid", `${label} possui caminho inválido: ${String(value)}`, file);
    return null;
  }
  return value;
}

function validateHistoricalPolicies(entry, tableName, accessMode, violations) {
  const raw = entry?.historicalPolicies ?? [];
  if (!Array.isArray(raw)) {
    addViolation(
      violations,
      "manifest_historical_policies_invalid",
      `${tableName}.historicalPolicies deve ser um array`,
      MANIFEST_FILE,
    );
    return [];
  }
  if (accessMode !== "rpc_only" && raw.length > 0) {
    addViolation(
      violations,
      "manifest_historical_policies_unexpected",
      `${tableName} não é RPC-only e não deve declarar policies históricas`,
      MANIFEST_FILE,
    );
  }

  const policies = [];
  for (const policy of raw) {
    const name = policy?.name;
    if (typeof name !== "string" || !POLICY_NAME.test(name)) {
      addViolation(
        violations,
        "manifest_historical_policy_name_invalid",
        `${tableName} possui nome de policy histórica inválido: ${String(name)}`,
        MANIFEST_FILE,
      );
      continue;
    }
    const migration = validateRepositoryPath(
      policy?.migration,
      `${tableName}.historicalPolicies.${name}.migration`,
      violations,
    );
    policies.push({ name, migration });
  }

  const duplicates = duplicateValues(policies.map(({ name, migration }) => `${name}:${migration}`));
  if (duplicates.length > 0) {
    addViolation(
      violations,
      "manifest_historical_policy_duplicates",
      `${tableName} contém policies históricas duplicadas: ${duplicates.join(", ")}`,
      MANIFEST_FILE,
    );
  }
  return policies;
}

function validateTables(manifest, violations) {
  if (!Array.isArray(manifest.tables)) {
    addViolation(violations, "manifest_tables_missing", "tables deve ser um array", MANIFEST_FILE);
    return [];
  }

  const tables = [];
  for (const entry of manifest.tables) {
    const name = entry?.name;
    if (typeof name !== "string" || !TABLE_NAME.test(name)) {
      addViolation(violations, "manifest_table_name_invalid", `nome de tabela inválido: ${String(name)}`, MANIFEST_FILE);
      continue;
    }

    const accessMode = entry?.accessMode;
    if (!ACCESS_MODES.has(accessMode)) {
      addViolation(violations, "manifest_access_mode_invalid", `${name} possui accessMode inválido: ${String(accessMode)}`, MANIFEST_FILE);
    }

    const predicates = Array.isArray(entry?.readPredicates) ? entry.readPredicates : [];
    const validPredicates = predicates.filter(
      (predicate) => typeof predicate === "string" && predicate.trim().length > 0,
    );
    if (validPredicates.length !== predicates.length) {
      addViolation(violations, "manifest_predicate_invalid", `${name} contém predicado vazio ou inválido`, MANIFEST_FILE);
    }
    const predicateDuplicates = duplicateValues(validPredicates);
    if (predicateDuplicates.length > 0) {
      addViolation(
        violations,
        "manifest_predicate_duplicates",
        `${name} contém predicados duplicados: ${predicateDuplicates.join(", ")}`,
        MANIFEST_FILE,
      );
    }

    let definitionMigration = null;
    if (accessMode === "authenticated_read") {
      if (validPredicates.length === 0) {
        addViolation(violations, "manifest_predicates_missing", `${name} deve possuir ao menos um predicado de leitura`, MANIFEST_FILE);
      }
      if (entry?.definitionMigration != null) {
        addViolation(violations, "manifest_definition_migration_unexpected", `${name} não deve declarar definitionMigration`, MANIFEST_FILE);
      }
    }

    if (accessMode === "rpc_only") {
      if (validPredicates.length > 0) {
        addViolation(violations, "manifest_rpc_only_predicates_forbidden", `${name} é RPC-only e não pode declarar predicados de leitura do navegador`, MANIFEST_FILE);
      }
      definitionMigration = validateRepositoryPath(
        entry?.definitionMigration,
        `${name}.definitionMigration`,
        violations,
      );
    }

    const historicalPolicies = validateHistoricalPolicies(entry, name, accessMode, violations);
    tables.push({
      name,
      accessMode,
      readPredicates: validPredicates,
      definitionMigration,
      historicalPolicies,
    });
  }

  const tableDuplicates = duplicateValues(tables.map(({ name }) => name));
  if (tableDuplicates.length > 0) {
    addViolation(violations, "manifest_table_duplicates", `tabelas duplicadas: ${tableDuplicates.join(", ")}`, MANIFEST_FILE);
  }
  const migrationDuplicates = duplicateValues(
    tables.map(({ definitionMigration }) => definitionMigration).filter(Boolean),
  );
  if (migrationDuplicates.length > 0) {
    addViolation(
      violations,
      "manifest_definition_migration_duplicates",
      `migrations de definição duplicadas: ${migrationDuplicates.join(", ")}`,
      MANIFEST_FILE,
    );
  }
  return tables;
}

function predicateCaseBlock(source, tableName) {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`when '${escaped}' then([\\s\\S]*?)(?=\\n\\s*when '|\\n\\s*else )`));
  return match?.[1] || null;
}

function requireTokens(source, requirements, code, file, violations) {
  for (const requirement of requirements) {
    if (!source.includes(requirement)) {
      addViolation(violations, code, `contrato ausente: ${requirement}`, file);
    }
  }
}

function readControlledFile(repositoryRoot, file, code, detail, violations) {
  try {
    return readFileSync(resolve(repositoryRoot, file), "utf8");
  } catch {
    addViolation(violations, code, detail, file);
    return null;
  }
}

function validateRpcOnlyDefinition(repositoryRoot, table, violations) {
  if (!table.definitionMigration) return;
  const source = readControlledFile(
    repositoryRoot,
    table.definitionMigration,
    "rpc_only_definition_missing",
    `${table.name} referencia uma migration inexistente`,
    violations,
  );
  if (!source) return;

  requireTokens(
    source,
    [
      `create table if not exists public.${table.name}`,
      "store_id uuid not null",
      `alter table public.${table.name} enable row level security`,
      `revoke all on table public.${table.name}`,
    ],
    "rpc_only_definition_contract_missing",
    table.definitionMigration,
    violations,
  );

  const escaped = table.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`create\\s+policy[\\s\\S]*?on\\s+public\\.${escaped}\\b`, "i").test(source)) {
    addViolation(
      violations,
      "rpc_only_definition_policy_forbidden",
      `${table.name} não pode criar policy para papéis do navegador`,
      table.definitionMigration,
    );
  }
}

function validateHistoricalPolicySources(repositoryRoot, table, migration, violations) {
  for (const policy of table.historicalPolicies) {
    if (!policy.migration) continue;
    const source = readControlledFile(
      repositoryRoot,
      policy.migration,
      "historical_policy_migration_missing",
      `${table.name}.${policy.name} referencia uma migration histórica inexistente`,
      violations,
    );
    if (!source) continue;
    requireTokens(
      source,
      [`'${table.name}'`, `create policy ${policy.name}`],
      "historical_policy_contract_missing",
      policy.migration,
      violations,
    );
    const cleanup = `drop policy if exists ${policy.name} on public.${table.name};`;
    if (!migration.includes(cleanup)) {
      addViolation(
        violations,
        "rpc_only_historical_policy_cleanup_missing",
        `${table.name} não remove a policy histórica ${policy.name} na migration de lockdown`,
        MANIFEST_FILE,
      );
    }
  }
}

export function auditStoreRlsSurface(repositoryRoot) {
  const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, MANIFEST_FILE), "utf8"));
  const violations = [];

  if (manifest.schemaVersion !== 3) {
    addViolation(
      violations,
      "manifest_schema_unsupported",
      `schemaVersion esperado=3, recebido=${String(manifest.schemaVersion)}`,
      MANIFEST_FILE,
    );
  }

  const liveTestFile = validateRepositoryPath(manifest.liveTest, "liveTest", violations);
  const migrationFile = validateRepositoryPath(manifest.writeLockMigration, "writeLockMigration", violations);
  const workflowFile = validateRepositoryPath(manifest.workflow, "workflow", violations);
  const tables = validateTables(manifest, violations);
  const tableNames = tables.map(({ name }) => name);
  const readableTables = tables.filter(({ accessMode }) => accessMode === "authenticated_read");
  const rpcOnlyTables = tables.filter(({ accessMode }) => accessMode === "rpc_only");
  const readableTableNames = readableTables.map(({ name }) => name);
  const rpcOnlyTableNames = rpcOnlyTables.map(({ name }) => name);
  const predicateCount = readableTables.reduce(
    (total, { readPredicates }) => total + readPredicates.length,
    0,
  );
  const historicalPolicyCount = rpcOnlyTables.reduce(
    (total, { historicalPolicies }) => total + historicalPolicies.length,
    0,
  );

  for (const table of rpcOnlyTables) validateRpcOnlyDefinition(repositoryRoot, table, violations);

  if (!liveTestFile || !migrationFile || !workflowFile) {
    return {
      schemaVersion: manifest.schemaVersion,
      tableCount: tableNames.length,
      readableTableCount: readableTableNames.length,
      rpcOnlyTableCount: rpcOnlyTableNames.length,
      predicateCount,
      historicalPolicyCount,
      violations,
    };
  }

  const liveTest = readFileSync(resolve(repositoryRoot, liveTestFile), "utf8");
  const migration = readFileSync(resolve(repositoryRoot, migrationFile), "utf8");
  const workflow = readFileSync(resolve(repositoryRoot, workflowFile), "utf8");

  for (const table of rpcOnlyTables) {
    validateHistoricalPolicySources(repositoryRoot, table, migration, violations);
  }

  validateExactArray(tableNames, parseSqlArray(liveTest, "required_tables"), "live_table_inventory_drift", "required_tables", liveTestFile, violations);
  validateExactArray(readableTableNames, parseSqlArray(liveTest, "authenticated_read_tables"), "live_read_inventory_drift", "authenticated_read_tables", liveTestFile, violations);
  validateExactArray(rpcOnlyTableNames, parseSqlArray(liveTest, "rpc_only_tables"), "live_rpc_only_inventory_drift", "rpc_only_tables", liveTestFile, violations);
  validateExactArray(tableNames, parseSqlArray(migration, "locked_tables"), "migration_table_inventory_drift", "locked_tables", migrationFile, violations);
  validateExactArray(rpcOnlyTableNames, parseSqlArray(migration, "rpc_only_tables"), "migration_rpc_only_inventory_drift", "rpc_only_tables", migrationFile, violations);

  for (const { name, readPredicates } of readableTables) {
    const block = predicateCaseBlock(liveTest, name);
    if (!block) {
      addViolation(violations, "live_predicate_case_missing", `case de leitura ausente para ${name}`, liveTestFile);
      continue;
    }
    for (const predicate of readPredicates) {
      if (!block.includes(`position('${predicate}'`)) {
        addViolation(violations, "live_read_predicate_missing", `${name} perdeu o predicado ${predicate}`, liveTestFile);
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
      "missing_authenticated_read_privileges",
      "Authenticated read grants missing from readable store tables",
      "Anonymous RLS policies found inside the store boundary",
      "authenticated_write_policies",
      "Authenticated write policies remain inside the RPC-only store boundary",
      "missing_read_policies",
      "weak_read_policies",
      "dangerous_read_policies",
      "policy.qual is null",
      "lower(btrim(policy.qual)) in ('true', '(true)')",
      "Tautological or empty store read policies detected",
      "rpc_only_browser_privileges",
      "RPC-only store tables expose browser privileges",
      "rpc_only_browser_policies",
      "RPC-only store tables expose browser policies",
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
      "revoke all on table",
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
      "rpc_only_browser_privileges",
      "RPC-only store tables still expose browser privileges",
      "rpc_only_browser_policies",
      "RPC-only store tables still expose browser policies",
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
      'psql "$SUPABASE_HOMOLOGATION_DB_URL"',
    ],
    "workflow_contract_missing",
    workflowFile,
    violations,
  );

  if (/^\s*push:/m.test(workflow)) {
    addViolation(violations, "workflow_automatic_trigger_forbidden", "workflow vivo não pode executar em push", workflowFile);
  }
  for (const forbidden of ["netlify deploy", "supabase db push", "supabase migration up"]) {
    if (workflow.includes(forbidden)) {
      addViolation(violations, "workflow_mutation_forbidden", `workflow vivo contém comando proibido: ${forbidden}`, workflowFile);
    }
  }

  return {
    schemaVersion: manifest.schemaVersion,
    tableCount: tableNames.length,
    readableTableCount: readableTableNames.length,
    rpcOnlyTableCount: rpcOnlyTableNames.length,
    predicateCount,
    historicalPolicyCount,
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
