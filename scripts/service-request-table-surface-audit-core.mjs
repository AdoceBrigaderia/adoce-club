import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MANIFEST_FILE = "security/service-request-table-surface.json";
const SAFE_PATH = /^(security|supabase|scripts|\.github)\/[a-zA-Z0-9_./-]+$/;
const SQL_NAME = /^[a-z][a-z0-9_]*$/;

function violation(list, code, detail, file = MANIFEST_FILE) {
  list.push({ code, detail, file });
}

function controlledPath(value, label, list) {
  if (typeof value !== "string" || !SAFE_PATH.test(value) || value.includes("..")) {
    violation(list, "manifest_path_invalid", `${label} possui caminho inválido: ${String(value)}`);
    return null;
  }
  return value;
}

function read(root, file, code, detail, list) {
  if (!file) return "";
  try {
    return readFileSync(resolve(root, file), "utf8");
  } catch {
    violation(list, code, detail, file);
    return "";
  }
}

function requireTokens(source, tokens, code, file, list) {
  for (const token of tokens) {
    if (!source.includes(token)) violation(list, code, `contrato ausente: ${token}`, file);
  }
}

function sqlArray(source, variable) {
  const match = source.match(new RegExp(`${variable} text\\[\\] := array\\[([\\s\\S]*?)\\];`));
  return match ? [...match[1].matchAll(/'([a-z0-9_]+)'/g)].map((item) => item[1]) : null;
}

function exactArray(expected, actual, code, label, file, list) {
  if (!actual) {
    violation(list, `${code}_missing`, `${label} não foi encontrado`, file);
    return;
  }
  if (expected.length === actual.length && expected.every((value, index) => value === actual[index])) return;
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  violation(
    list,
    code,
    `${label} divergiu; ausentes=[${expected.filter((v) => !actualSet.has(v)).join(", ")}], inesperadas=[${actual.filter((v) => !expectedSet.has(v)).join(", ")}]`,
    file,
  );
}

function validateTables(root, manifest, list) {
  if (!Array.isArray(manifest.tables) || manifest.tables.length === 0) {
    violation(list, "manifest_tables_missing", "tables deve ser um array não vazio");
    return [];
  }

  const tables = [];
  for (const entry of manifest.tables) {
    const name = entry?.name;
    if (typeof name !== "string" || !SQL_NAME.test(name)) {
      violation(list, "manifest_table_name_invalid", `nome de tabela inválido: ${String(name)}`);
      continue;
    }

    let definitionMigration = null;
    const definitionEvidence = [];
    if (entry.definitionMigration) {
      definitionMigration = controlledPath(entry.definitionMigration, `${name}.definitionMigration`, list);
      const source = read(root, definitionMigration, "definition_migration_missing", `${name} referencia migration inexistente`, list);
      requireTokens(
        source,
        [
          `create table if not exists public.${name}`,
          `alter table public.${name} enable row level security`,
          `revoke all on public.${name} from public, anon, authenticated`,
        ],
        "definition_contract_missing",
        definitionMigration,
        list,
      );
    } else if (Array.isArray(entry.definitionEvidence) && entry.definitionEvidence.length > 0) {
      for (const evidence of entry.definitionEvidence) {
        const migration = controlledPath(evidence?.migration, `${name}.definitionEvidence.migration`, list);
        const tokens = Array.isArray(evidence?.tokens)
          ? evidence.tokens.filter((token) => typeof token === "string" && token.length > 0)
          : [];
        if (tokens.length === 0) violation(list, "definition_evidence_tokens_missing", `${name} possui evidência sem tokens`);
        const source = read(root, migration, "definition_evidence_migration_missing", `${name} referencia evidência inexistente`, list);
        requireTokens(source, tokens, "definition_evidence_contract_missing", migration, list);
        definitionEvidence.push({ migration, tokens });
      }
    } else {
      violation(list, "definition_evidence_missing", `${name} não possui evidência de definição`);
    }

    let scope = null;
    if (entry.scope != null) {
      if (
        entry.scope.mode !== "direct" ||
        !SQL_NAME.test(String(entry.scope.column)) ||
        !SQL_NAME.test(String(entry.scope.parentTable))
      ) {
        violation(list, "direct_scope_invalid", `${name}.scope é inválido`);
      } else {
        scope = { mode: "direct", column: entry.scope.column, parentTable: entry.scope.parentTable };
      }
    }

    let parentScope = null;
    if (entry.parentScope != null) {
      const parentTable = entry.parentScope.table;
      const foreignKey = entry.parentScope.foreignKey;
      if (!SQL_NAME.test(String(parentTable)) || !SQL_NAME.test(String(foreignKey))) {
        violation(list, "parent_scope_invalid", `${name}.parentScope é inválido`);
      } else {
        parentScope = { table: parentTable, foreignKey };
        const source = read(root, definitionMigration, "definition_migration_missing", `${name} referencia migration inexistente`, list);
        requireTokens(
          source,
          [`${foreignKey} uuid primary key references public.${parentTable}(id)`],
          "parent_scope_contract_missing",
          definitionMigration,
          list,
        );
      }
    }
    tables.push({ name, definitionMigration, definitionEvidence, scope, parentScope });
  }

  const names = tables.map(({ name }) => name);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length) violation(list, "manifest_table_duplicates", `tabelas duplicadas: ${[...new Set(duplicates)].join(", ")}`);
  const declared = new Set(names);
  for (const table of tables) {
    if (table.parentScope && !declared.has(table.parentScope.table)) {
      violation(list, "parent_scope_table_missing", `${table.name} depende de tabela não declarada: ${table.parentScope.table}`);
    }
  }
  if (tables.filter(({ scope }) => scope?.mode === "direct").length !== 1) {
    violation(list, "direct_scope_count_invalid", "deve existir exatamente uma tabela raiz com escopo direto");
  }
  return tables;
}

export function auditServiceRequestTableSurface(repositoryRoot) {
  const violations = [];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolve(repositoryRoot, MANIFEST_FILE), "utf8"));
  } catch {
    return {
      schemaVersion: null,
      tableCount: 0,
      parentScopedTableCount: 0,
      evidenceCount: 0,
      controlledFileCount: 0,
      violations: [{ code: "manifest_missing", detail: "manifesto ausente ou inválido", file: MANIFEST_FILE }],
    };
  }
  if (manifest.schemaVersion !== 2) {
    violation(violations, "manifest_schema_unsupported", `schemaVersion esperado=2, recebido=${String(manifest.schemaVersion)}`);
  }

  const liveFile = controlledPath(manifest.liveTest, "liveTest", violations);
  const lockFile = controlledPath(manifest.lockMigration, "lockMigration", violations);
  const hardeningFile = controlledPath(manifest.hardeningMigration, "hardeningMigration", violations);
  const workspaceHardeningFile = controlledPath(
    manifest.workspaceHardeningMigration,
    "workspaceHardeningMigration",
    violations,
  );
  const workflowFile = controlledPath(manifest.workflow, "workflow", violations);
  const tables = validateTables(repositoryRoot, manifest, violations);
  const tableNames = tables.map(({ name }) => name);
  const childNames = tables.filter(({ parentScope }) => parentScope).map(({ name }) => name);
  const lock = read(repositoryRoot, lockFile, "lock_migration_missing", "migration de lockdown ausente", violations);
  const live = read(repositoryRoot, liveFile, "live_test_missing", "ensaio vivo ausente", violations);
  const hardening = read(repositoryRoot, hardeningFile, "hardening_migration_missing", "migration de hardening ausente", violations);
  const workspaceHardening = read(
    repositoryRoot,
    workspaceHardeningFile,
    "workspace_hardening_migration_missing",
    "migration final do workspace ausente",
    violations,
  );
  const workflow = read(repositoryRoot, workflowFile, "workflow_missing", "workflow de homologação ausente", violations);

  exactArray(tableNames, sqlArray(lock, "locked_service_request_tables"), "lock_inventory_drift", "locked_service_request_tables", lockFile, violations);
  exactArray(tableNames, sqlArray(live, "required_service_request_tables"), "live_inventory_drift", "required_service_request_tables", liveFile, violations);
  exactArray(childNames, sqlArray(lock, "child_service_request_tables"), "lock_child_inventory_drift", "child_service_request_tables", lockFile, violations);
  exactArray(childNames, sqlArray(live, "child_service_request_tables"), "live_child_inventory_drift", "child_service_request_tables", liveFile, violations);

  const tableList = tableNames.map((name, index) => `  public.${name}${index === tableNames.length - 1 ? "" : ","}`).join("\n");
  if (!lock.includes(`revoke all on table\n${tableList}\nfrom public, anon, authenticated;`)) {
    violation(violations, "lock_table_revoke_missing", "lockdown não revoga exatamente todas as tabelas do navegador", lockFile);
  }
  if (!lock.includes(`grant all on table\n${tableList}\nto service_role;`)) {
    violation(violations, "lock_service_role_grant_missing", "lockdown não preserva exatamente todas as tabelas para service_role", lockFile);
  }

  requireTokens(
    lock,
    [
      "add column if not exists store_id uuid references public.stores(id) on delete restrict",
      "drop policy if exists %I on public.%I",
      "requested_store_id uuid default null",
      "set store_id = resolved_store_id",
      "private.staff_has_capability(request.store_id, 'manage_orders')",
      "private.staff_has_capability(request.store_id, 'manage_customers')",
      "Service-request RPC-only tables still expose browser privileges",
      "Service-request RPC-only tables still expose browser policies",
      "service_requests.store_id is missing from the operational scope",
      "Service-request child tables lost request_id parent foreign keys",
      "begin;",
      "commit;",
    ],
    "lock_contract_missing",
    lockFile,
    violations,
  );
  requireTokens(
    hardening,
    [
      "where request.store_id is null",
      "active_store_count <> 1",
      "create constraint trigger service_requests_store_scope_required",
      "deferrable initially deferred",
      "revoke all on function public.submit_service_request_bff_unscoped_internal",
      "revoke all on function public.staff_get_service_request_workspace_unscoped_internal",
      "revoke all on function public.staff_get_customer_service_request_history_unscoped_internal",
      "from public, anon, authenticated, service_role;",
      "has_function_privilege('service_role', signature, 'EXECUTE')",
      "Service requests still contain rows without store scope",
      "Deferred service-request store-scope trigger is missing",
      "Internal service-request functions remain executable by service_role",
      "begin;",
      "commit;",
    ],
    "hardening_contract_missing",
    hardeningFile,
    violations,
  );
  requireTokens(
    workspaceHardening,
    [
      "drop function if exists public.staff_get_service_request_workspace(text,text,integer)",
      "target_store_id uuid default null",
      "private.staff_has_any_capability('manage_orders')",
      "private.staff_has_capability(target_store_id, 'manage_orders')",
      "private.staff_has_capability(request.store_id, 'manage_orders')",
      "target_store_id is null or request.store_id = target_store_id",
      "private.staff_has_capability(request.store_id, 'view_finance')",
      "join public.stores store on store.id = request.store_id",
      "A assinatura antiga do workspace de encomendas permanece disponível",
      "O workspace de encomendas perdeu isolamento por loja ou teto financeiro",
      "begin;",
      "commit;",
    ],
    "workspace_hardening_contract_missing",
    workspaceHardeningFile,
    violations,
  );
  if (workspaceHardening.includes("staff_get_service_request_workspace_unscoped_internal(")) {
    violation(
      violations,
      "workspace_unscoped_call_forbidden",
      "hardening final voltou a consultar a implementação global sem escopo",
      workspaceHardeningFile,
    );
  }
  requireTokens(
    live,
    [
      "Service-request RPC-only tables are missing",
      "RLS disabled on service-request RPC-only tables",
      "Service-request RPC-only tables expose browser privileges",
      "Service-request RPC-only tables expose browser policies",
      "service_requests.store_id is missing from the operational scope",
      "Service-request child tables lost request_id parent foreign keys",
      "submit_service_request_bff lost the store-scoped signature",
      "staff_get_service_request_workspace lost the store filter signature",
      "staff_get_service_request_workspace restored the unscoped public signature",
      "staff_get_service_request_workspace still scans the unscoped implementation",
      "staff_get_service_request_workspace lost row-level store authorization",
      "staff_get_service_request_workspace lost the financial capability ceiling",
      "begin;",
      "rollback;",
    ],
    "live_contract_missing",
    liveFile,
    violations,
  );
  requireTokens(
    workflow,
    [
      "workflow_dispatch:",
      "EXPECTED_BRANCH: reestruturacao/ux-crm-operacao-imagens-v1",
      'test "$CONFIRMATION" = "AUDITAR ENCOMENDAS RPC SOMENTE HOMOLOGACAO $HOMOLOGATION_REF"',
      "SUPABASE_HOMOLOGATION_DB_URL",
      "ADOCE_HOMOLOGATION_SUPABASE_REF",
      "ADOCE_PRODUCTION_SUPABASE_REF",
      "node scripts/audit-service-request-table-surface.mjs",
      liveFile || "supabase/tests/service_request_rpc_boundary_live.sql",
      hardeningFile || "supabase/migrations/20260729203000_harden_service_request_store_scope.sql",
      workspaceHardeningFile || "supabase/migrations/20260729212000_scope_service_request_workspace_by_store.sql",
      "hardening-migration.sha256",
      "workspace-hardening-migration.sha256",
      "Referência de produção detectada e bloqueada",
      'psql "$SUPABASE_HOMOLOGATION_DB_URL"',
    ],
    "workflow_contract_missing",
    workflowFile,
    violations,
  );
  if (/^\s*push:/m.test(workflow)) {
    violation(violations, "workflow_automatic_trigger_forbidden", "workflow vivo não pode executar em push", workflowFile);
  }
  for (const forbidden of ["netlify deploy", "supabase db push", "supabase migration up"]) {
    if (workflow.includes(forbidden)) violation(violations, "workflow_mutation_forbidden", `workflow contém comando proibido: ${forbidden}`, workflowFile);
  }

  const controlledFiles = new Set([
    MANIFEST_FILE,
    liveFile,
    lockFile,
    hardeningFile,
    workspaceHardeningFile,
    workflowFile,
    ...tables.map(({ definitionMigration }) => definitionMigration),
    ...tables.flatMap(({ definitionEvidence }) => definitionEvidence.map(({ migration }) => migration)),
  ].filter(Boolean));
  return {
    schemaVersion: manifest.schemaVersion,
    tableCount: tableNames.length,
    parentScopedTableCount: childNames.length,
    evidenceCount: tables.reduce((total, table) => total + table.definitionEvidence.length + (table.definitionMigration ? 1 : 0), 0),
    controlledFileCount: controlledFiles.size,
    violations,
  };
}

export function assertServiceRequestTableSurface(repositoryRoot) {
  const result = auditServiceRequestTableSurface(repositoryRoot);
  if (result.violations.length) {
    const details = result.violations
      .map(({ file, code, detail }) => `- ${file || MANIFEST_FILE}: ${code} — ${detail}`)
      .join("\n");
    throw new Error(`Auditoria da superfície RPC das encomendas reprovada:\n${details}`);
  }
  return result;
}
