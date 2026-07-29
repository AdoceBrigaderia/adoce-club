import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MANIFEST_FILE = "security/order-table-surface.json";
const SAFE_PATH = /^(security|supabase|scripts|\.github)\/[a-zA-Z0-9_./-]+$/;
const SQL_NAME = /^[a-z][a-z0-9_]*$/;

function addViolation(violations, code, detail, file = MANIFEST_FILE) {
  violations.push({ code, detail, file });
}

function unique(values) {
  return [...new Set(values)];
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

function parseSqlArray(source, name) {
  const match = source.match(new RegExp(`${name} text\\[\\] := array\\[([\\s\\S]*?)\\];`));
  if (!match) return null;
  return [...match[1].matchAll(/'([a-z0-9_]+)'/g)].map((item) => item[1]);
}

function validateExactArray(expected, actual, code, label, file, violations) {
  if (!actual) {
    addViolation(violations, `${code}_missing`, `${label} não foi encontrado`, file);
    return;
  }
  if (arraysEqual(expected, actual)) return;
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  addViolation(
    violations,
    code,
    `${label} divergiu; ausentes=[${expected.filter((value) => !actualSet.has(value)).join(", ")}], inesperadas=[${actual.filter((value) => !expectedSet.has(value)).join(", ")}]`,
    file,
  );
}

function validatePath(value, label, violations) {
  if (typeof value !== "string" || !SAFE_PATH.test(value) || value.includes("..")) {
    addViolation(violations, "manifest_path_invalid", `${label} possui caminho inválido: ${String(value)}`);
    return null;
  }
  return value;
}

function readControlledFile(repositoryRoot, file, code, detail, violations) {
  if (!file) return null;
  try {
    return readFileSync(resolve(repositoryRoot, file), "utf8");
  } catch {
    addViolation(violations, code, detail, file);
    return null;
  }
}

function requireTokens(source, tokens, code, file, violations) {
  for (const token of tokens) {
    if (!source.includes(token)) addViolation(violations, code, `contrato ausente: ${token}`, file);
  }
}

function validateTables(repositoryRoot, manifest, lockMigration, violations) {
  if (!Array.isArray(manifest.tables) || manifest.tables.length === 0) {
    addViolation(violations, "manifest_tables_missing", "tables deve ser um array não vazio");
    return [];
  }

  const tables = [];
  for (const entry of manifest.tables) {
    const name = entry?.name;
    if (typeof name !== "string" || !SQL_NAME.test(name)) {
      addViolation(violations, "manifest_table_name_invalid", `nome de tabela inválido: ${String(name)}`);
      continue;
    }

    const definitionMigration = validatePath(entry?.definitionMigration, `${name}.definitionMigration`, violations);
    const definition = readControlledFile(
      repositoryRoot,
      definitionMigration,
      "definition_migration_missing",
      `${name} referencia uma migration de definição inexistente`,
      violations,
    );
    if (definition) {
      requireTokens(
        definition,
        [
          `create table if not exists public.${name}`,
          `alter table public.${name} enable row level security`,
          "revoke all on public.pickup_locations, public.instant_orders, public.instant_order_items",
        ],
        "definition_contract_missing",
        definitionMigration,
        violations,
      );
    }

    const scopeEvidence = [];
    const rawScopeEvidence = entry?.scopeEvidence ?? [];
    if (!Array.isArray(rawScopeEvidence)) {
      addViolation(violations, "scope_evidence_invalid", `${name}.scopeEvidence deve ser um array`);
    } else {
      for (const evidence of rawScopeEvidence) {
        const migration = validatePath(evidence?.migration, `${name}.scopeEvidence.migration`, violations);
        const tokens = Array.isArray(evidence?.tokens)
          ? evidence.tokens.filter((token) => typeof token === "string" && token.length > 0)
          : [];
        if (tokens.length === 0) addViolation(violations, "scope_evidence_tokens_missing", `${name} possui evidência sem tokens`);
        const source = readControlledFile(
          repositoryRoot,
          migration,
          "scope_evidence_migration_missing",
          `${name} referencia uma migration de escopo inexistente`,
          violations,
        );
        if (source) requireTokens(source, tokens, "scope_evidence_contract_missing", migration, violations);
        scopeEvidence.push({ migration, tokens });
      }
    }

    let parentScope = null;
    if (entry?.parentScope != null) {
      const parentTable = entry.parentScope.table;
      const foreignKey = entry.parentScope.foreignKey;
      if (!SQL_NAME.test(String(parentTable)) || !SQL_NAME.test(String(foreignKey))) {
        addViolation(violations, "parent_scope_invalid", `${name}.parentScope é inválido`);
      } else {
        parentScope = { table: parentTable, foreignKey };
        if (definition) {
          requireTokens(
            definition,
            [`${foreignKey} uuid not null references public.${parentTable}(id)`],
            "parent_scope_contract_missing",
            definitionMigration,
            violations,
          );
        }
      }
    }

    const historicalPolicies = [];
    const rawPolicies = entry?.historicalPolicies ?? [];
    if (!Array.isArray(rawPolicies)) {
      addViolation(violations, "historical_policies_invalid", `${name}.historicalPolicies deve ser um array`);
    } else {
      for (const policy of rawPolicies) {
        const policyName = policy?.name;
        const migration = validatePath(policy?.migration, `${name}.historicalPolicies.migration`, violations);
        if (typeof policyName !== "string" || !SQL_NAME.test(policyName)) {
          addViolation(violations, "historical_policy_name_invalid", `${name} possui policy histórica inválida`);
          continue;
        }
        const source = readControlledFile(
          repositoryRoot,
          migration,
          "historical_policy_migration_missing",
          `${name}.${policyName} referencia uma migration inexistente`,
          violations,
        );
        if (source) {
          requireTokens(
            source,
            [`create policy ${policyName}`, `on public.${name}`],
            "historical_policy_contract_missing",
            migration,
            violations,
          );
        }
        const cleanup = `drop policy if exists ${policyName} on public.${name};`;
        if (!lockMigration.includes(cleanup)) {
          addViolation(violations, "historical_policy_cleanup_missing", `${name} não remove ${policyName} no lockdown`);
        }
        historicalPolicies.push({ name: policyName, migration });
      }
    }

    tables.push({ name, definitionMigration, scopeEvidence, parentScope, historicalPolicies });
  }

  const duplicates = duplicateValues(tables.map(({ name }) => name));
  if (duplicates.length > 0) addViolation(violations, "manifest_table_duplicates", `tabelas duplicadas: ${duplicates.join(", ")}`);

  const tableNames = new Set(tables.map(({ name }) => name));
  for (const table of tables) {
    if (table.parentScope && !tableNames.has(table.parentScope.table)) {
      addViolation(violations, "parent_scope_table_missing", `${table.name} depende de tabela não declarada: ${table.parentScope.table}`);
    }
  }

  return tables;
}

export function auditOrderTableSurface(repositoryRoot) {
  const violations = [];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolve(repositoryRoot, MANIFEST_FILE), "utf8"));
  } catch {
    return {
      schemaVersion: null,
      tableCount: 0,
      historicalPolicyCount: 0,
      scopeEvidenceCount: 0,
      violations: [{ code: "manifest_missing", detail: "manifesto ausente ou inválido", file: MANIFEST_FILE }],
    };
  }

  if (manifest.schemaVersion !== 1) {
    addViolation(violations, "manifest_schema_unsupported", `schemaVersion esperado=1, recebido=${String(manifest.schemaVersion)}`);
  }

  const liveTestFile = validatePath(manifest.liveTest, "liveTest", violations);
  const lockMigrationFile = validatePath(manifest.lockMigration, "lockMigration", violations);
  const workflowFile = validatePath(manifest.workflow, "workflow", violations);
  const lockMigration = readControlledFile(repositoryRoot, lockMigrationFile, "lock_migration_missing", "migration de lockdown ausente", violations) || "";
  const tables = validateTables(repositoryRoot, manifest, lockMigration, violations);
  const tableNames = tables.map(({ name }) => name);
  const historicalPolicyCount = tables.reduce((total, table) => total + table.historicalPolicies.length, 0);
  const scopeEvidenceCount = tables.reduce((total, table) => total + table.scopeEvidence.length, 0);

  const liveTest = readControlledFile(repositoryRoot, liveTestFile, "live_test_missing", "ensaio vivo ausente", violations) || "";
  const workflow = readControlledFile(repositoryRoot, workflowFile, "workflow_missing", "workflow de homologação ausente", violations) || "";

  validateExactArray(tableNames, parseSqlArray(lockMigration, "locked_order_tables"), "lock_inventory_drift", "locked_order_tables", lockMigrationFile, violations);
  validateExactArray(tableNames, parseSqlArray(liveTest, "required_order_tables"), "live_inventory_drift", "required_order_tables", liveTestFile, violations);

  requireTokens(
    lockMigration,
    [
      "revoke all on table",
      "from public, anon, authenticated",
      "grant all on table",
      "to service_role",
      "RLS disabled on instant-order RPC-only tables",
      "Instant-order RPC-only tables still expose browser privileges",
      "Instant-order RPC-only tables still expose browser policies",
      "instant_orders.store_id is missing from the operational scope",
      "instant_order_items lost its parent order foreign key",
      "begin;",
      "commit;",
    ],
    "lock_contract_missing",
    lockMigrationFile,
    violations,
  );

  requireTokens(
    liveTest,
    [
      "Instant-order RPC-only tables are missing",
      "RLS disabled on instant-order RPC-only tables",
      "Instant-order RPC-only tables expose browser privileges",
      "Instant-order RPC-only tables expose browser policies",
      "instant_orders.store_id is missing from the operational scope",
      "instant_order_items.order_id lost its parent foreign key",
      "begin;",
      "rollback;",
    ],
    "live_contract_missing",
    liveTestFile,
    violations,
  );

  requireTokens(
    workflow,
    [
      "workflow_dispatch:",
      "EXPECTED_BRANCH: reestruturacao/ux-crm-operacao-imagens-v1",
      'test "$CONFIRMATION" = "AUDITAR PEDIDOS RPC SOMENTE HOMOLOGACAO $HOMOLOGATION_REF"',
      "SUPABASE_HOMOLOGATION_DB_URL",
      "ADOCE_HOMOLOGATION_SUPABASE_REF",
      "ADOCE_PRODUCTION_SUPABASE_REF",
      "node scripts/audit-order-table-surface.mjs",
      liveTestFile || "supabase/tests/instant_order_rpc_boundary_live.sql",
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
    if (workflow.includes(forbidden)) addViolation(violations, "workflow_mutation_forbidden", `workflow contém comando proibido: ${forbidden}`, workflowFile);
  }

  return {
    schemaVersion: manifest.schemaVersion,
    tableCount: tableNames.length,
    historicalPolicyCount,
    scopeEvidenceCount,
    controlledFileCount: unique([
      MANIFEST_FILE,
      liveTestFile,
      lockMigrationFile,
      workflowFile,
      ...tables.map(({ definitionMigration }) => definitionMigration),
      ...tables.flatMap(({ scopeEvidence }) => scopeEvidence.map(({ migration }) => migration)),
      ...tables.flatMap(({ historicalPolicies }) => historicalPolicies.map(({ migration }) => migration)),
    ].filter(Boolean)).length,
    violations,
  };
}

export function assertOrderTableSurface(repositoryRoot) {
  const result = auditOrderTableSurface(repositoryRoot);
  if (result.violations.length > 0) {
    const details = result.violations
      .map(({ file, code, detail }) => `- ${file || MANIFEST_FILE}: ${code} — ${detail}`)
      .join("\n");
    throw new Error(`Auditoria da superfície RPC dos pedidos reprovada:\n${details}`);
  }
  return result;
}
