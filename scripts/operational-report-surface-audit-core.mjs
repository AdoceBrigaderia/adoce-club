import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MANIFEST_FILE = "security/operational-report-surface.json";
const SAFE_PATH = /^(security|supabase|scripts|\.github)\/[a-zA-Z0-9_./-]+$/;

function add(list, code, detail, file = MANIFEST_FILE) {
  list.push({ code, detail, file });
}

function read(root, file, code, list) {
  try {
    return readFileSync(resolve(root, file), "utf8");
  } catch {
    add(list, code, `arquivo ausente: ${file}`, file);
    return "";
  }
}

function safePath(value, label, list) {
  if (typeof value !== "string" || !SAFE_PATH.test(value) || value.includes("..")) {
    add(list, "manifest_path_invalid", `${label} inválido: ${String(value)}`);
    return "";
  }
  return value;
}

function requireTokens(source, tokens, code, file, list) {
  for (const token of tokens) {
    if (!source.includes(token)) add(list, code, `contrato ausente: ${token}`, file);
  }
}

function exactArray(value, expected, label, list) {
  if (!Array.isArray(value) || value.length !== expected.length || expected.some((item, index) => value[index] !== item)) {
    add(list, "manifest_array_drift", `${label} divergiu do contrato esperado`);
  }
}

export function auditOperationalReportSurface(repositoryRoot) {
  const violations = [];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolve(repositoryRoot, MANIFEST_FILE), "utf8"));
  } catch {
    return {
      schemaVersion: null,
      breakdownCount: 0,
      protectedFinancialFieldCount: 0,
      controlledFileCount: 0,
      violations: [{ code: "manifest_missing", detail: "manifesto ausente ou inválido", file: MANIFEST_FILE }],
    };
  }

  if (manifest.schemaVersion !== 1) {
    add(violations, "manifest_schema_unsupported", `schemaVersion esperado=1, recebido=${String(manifest.schemaVersion)}`);
  }

  const baseFile = safePath(manifest.baseHardeningMigration, "baseHardeningMigration", violations);
  const breakdownFile = safePath(manifest.breakdownMigration, "breakdownMigration", violations);
  const liveFile = safePath(manifest.liveTest, "liveTest", violations);
  const workflowFile = safePath(manifest.workflow, "workflow", violations);
  const base = read(repositoryRoot, baseFile, "base_migration_missing", violations);
  const breakdown = read(repositoryRoot, breakdownFile, "breakdown_migration_missing", violations);
  const live = read(repositoryRoot, liveFile, "live_test_missing", violations);
  const workflow = read(repositoryRoot, workflowFile, "workflow_missing", violations);

  if (manifest.publicFunction !== "public.staff_get_operational_reports(date,date,uuid)") {
    add(violations, "public_function_drift", "assinatura pública do relatório divergiu");
  }
  if (manifest.baseInternalFunction !== "public.staff_get_operational_reports_base_internal(date,date,uuid)") {
    add(violations, "internal_function_drift", "assinatura interna do relatório divergiu");
  }

  exactArray(manifest.capabilities, ["view_reports", "view_finance"], "capabilities", violations);
  exactArray(
    manifest.breakdowns,
    ["orders_by_channel", "sales_by_cash_register", "sales_by_operator", "cash_sessions_by_register"],
    "breakdowns",
    violations,
  );

  if (manifest.roles?.owner !== "financial" || manifest.roles?.manager !== "financial" || manifest.roles?.viewer !== "operational_only") {
    add(violations, "role_contract_drift", "contrato owner/manager/viewer divergiu");
  }
  if (!Array.isArray(manifest.protectedFinancialFields) || manifest.protectedFinancialFields.length < 10) {
    add(violations, "financial_fields_missing", "campos financeiros protegidos estão incompletos");
  }

  requireTokens(
    base,
    [
      "private.staff_has_any_capability('view_reports')",
      "private.staff_has_capability(store.id, 'view_reports')",
      "private.staff_has_capability(store.id, 'view_finance')",
      "finance_scope_complete",
      "else null",
      "revoke all on function public.staff_get_operational_reports(date,date,uuid)",
      "grant execute on function public.staff_get_operational_reports(date,date,uuid)",
      "to authenticated;",
      "begin;",
      "commit;",
    ],
    "base_contract_missing",
    baseFile,
    violations,
  );

  requireTokens(
    breakdown,
    [
      "rename to staff_get_operational_reports_base_internal",
      "from public, anon, authenticated, service_role;",
      "report := public.staff_get_operational_reports_base_internal(",
      "private.staff_has_capability(store.id, 'view_reports')",
      "private.staff_has_capability(store.id, 'view_finance')",
      "when customer_order.cash_session_id is null then 'online'",
      "else 'presencial'",
      "orders_by_channel",
      "sales_by_cash_register",
      "sales_by_operator",
      "cash_sessions_by_register",
      "has_function_privilege(",
      "'service_role',",
      "begin;",
      "commit;",
    ],
    "breakdown_contract_missing",
    breakdownFile,
    violations,
  );

  for (const field of manifest.protectedFinancialFields || []) {
    if (!base.includes(`'${field}'`) && !breakdown.includes(`'${field}'`)) {
      add(violations, "financial_field_untracked", `campo financeiro sem evidência SQL: ${field}`);
    }
  }

  requireTokens(
    live,
    [
      "role = 'viewer'::public.staff_role",
      "Viewer recebeu valores financeiros no relatório",
      "Viewer acessou relatório de loja sem atribuição",
      "role = 'manager'::public.staff_role",
      "Manager não recebeu visão financeira",
      "Owner não recebeu visão financeira",
      "jsonb_typeof(report->'orders_by_channel')",
      "has_function_privilege(",
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
      "environment: homologation",
      "node scripts/audit-operational-report-surface.mjs",
      "psql \"$SUPABASE_HOMOLOGATION_DB_URL\"",
      "--set=ON_ERROR_STOP=1",
      "sha256sum security/operational-report-surface.json",
      "retention-days: 30",
    ],
    "workflow_contract_missing",
    workflowFile,
    violations,
  );

  if (/\b(push|pull_request|schedule):/.test(workflow)) {
    add(violations, "workflow_trigger_forbidden", "workflow vivo deve permanecer exclusivamente manual", workflowFile);
  }
  if (/supabase\s+db\s+(push|reset)|netlify\s+deploy|--prod\b/i.test(workflow)) {
    add(violations, "workflow_mutation_forbidden", "workflow vivo contém comando de migration ou deploy", workflowFile);
  }

  return {
    schemaVersion: manifest.schemaVersion ?? null,
    breakdownCount: Array.isArray(manifest.breakdowns) ? manifest.breakdowns.length : 0,
    protectedFinancialFieldCount: Array.isArray(manifest.protectedFinancialFields)
      ? manifest.protectedFinancialFields.length
      : 0,
    controlledFileCount: [MANIFEST_FILE, baseFile, breakdownFile, liveFile, workflowFile].filter(Boolean).length,
    violations,
  };
}
