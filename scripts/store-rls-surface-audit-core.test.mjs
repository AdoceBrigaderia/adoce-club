import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertStoreRlsSurface, auditStoreRlsSurface } from "./store-rls-surface-audit-core.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, "security/store-rls-surface.json"), "utf8"));
const controlledFiles = [
  "security/store-rls-surface.json",
  manifest.liveTest,
  manifest.writeLockMigration,
  manifest.workflow,
  ...manifest.tables.map(({ definitionMigration }) => definitionMigration).filter(Boolean),
];

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "adoce-store-rls-surface-"));
  for (const relative of controlledFiles) {
    const target = resolve(root, relative);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(resolve(repositoryRoot, relative), target);
  }
  return root;
}

function mutate(root, relative, transform) {
  const path = resolve(root, relative);
  writeFileSync(path, transform(readFileSync(path, "utf8")), "utf8");
}

test("aprova a superfície RLS por loja versionada", () => {
  const result = assertStoreRlsSurface(repositoryRoot);
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.tableCount, 7);
  assert.equal(result.readableTableCount, 5);
  assert.equal(result.rpcOnlyTableCount, 2);
  assert.equal(result.predicateCount, 6);
  assert.deepEqual(result.violations, []);
});

test("mantém auditoria RLS conectada aos dois gates locais", () => {
  const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["test:store-rls-surface"], "node --test scripts/store-rls-surface-audit-core.test.mjs");
  assert.equal(packageJson.scripts["audit:store-rls-surface"], "node scripts/audit-store-rls-surface.mjs");
  for (const gate of ["verify:fast", "verify"]) {
    assert.match(packageJson.scripts[gate], /npm run test:store-rls-surface/);
    assert.match(packageJson.scripts[gate], /npm run audit:store-rls-surface/);
  }
});

test("reprova drift entre manifesto, ensaio vivo e migration", () => {
  const root = fixture();
  mutate(root, manifest.liveTest, (source) => source.replace("    'cash_movements',\n", ""));
  const result = auditStoreRlsSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "live_table_inventory_drift"));
  assert.throws(() => assertStoreRlsSurface(root), /live_table_inventory_drift/);
});

test("reprova perda de predicado de isolamento por loja", () => {
  const root = fixture();
  mutate(root, manifest.liveTest, (source) => source.replace("position('private.can_access_store(id)'", "position('true'"));
  const result = auditStoreRlsSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "live_read_predicate_missing"));
});

test("reprova retorno de policies de escrita autenticada", () => {
  const root = fixture();
  mutate(root, manifest.liveTest, (source) => source.replaceAll("authenticated_write_policies", "removed_write_policy_guard"));
  const result = auditStoreRlsSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "live_fail_closed_contract_missing"));
});

test("reprova migration que perde o corte de escrita direta", () => {
  const root = fixture();
  mutate(root, manifest.writeLockMigration, (source) => source.replaceAll("from public, anon, authenticated", "from authenticated"));
  const result = auditStoreRlsSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "write_lock_migration_contract_missing"));
});

test("reprova execução viva automática ou mutável", () => {
  const root = fixture();
  mutate(root, manifest.workflow, (source) => `${source}\n  push:\n    branches: [main]\n# supabase db push\n`);
  const result = auditStoreRlsSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "workflow_automatic_trigger_forbidden"));
  assert.ok(result.violations.some(({ code }) => code === "workflow_mutation_forbidden"));
});

test("reprova drift no inventário RPC-only", () => {
  const root = fixture();
  mutate(root, manifest.liveTest, (source) => source.replace("  rpc_only_tables text[] := array[\n    'customer_checkins',\n    'cash_reconciliation_queue'\n  ];", "  rpc_only_tables text[] := array[\n    'customer_checkins'\n  ];"));
  const result = auditStoreRlsSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "live_rpc_only_inventory_drift"));
});

test("reprova tabela RPC-only que perde revogação total", () => {
  const root = fixture();
  const migration = "supabase/migrations/20260726191325_customer_nfc_qr_checkins.sql";
  mutate(root, migration, (source) => source.replace("revoke all on table public.customer_checkins", "revoke select on table public.customer_checkins"));
  const result = auditStoreRlsSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "rpc_only_definition_contract_missing"));
});

test("reprova predicado de navegador em tabela RPC-only", () => {
  const root = fixture();
  mutate(root, "security/store-rls-surface.json", (source) => source.replace('"name": "customer_checkins",\n      "accessMode": "rpc_only",\n      "readPredicates": []', '"name": "customer_checkins",\n      "accessMode": "rpc_only",\n      "readPredicates": ["true"]'));
  const result = auditStoreRlsSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "manifest_rpc_only_predicates_forbidden"));
});

test("reprova perda dos guards de privilégios e policies RPC-only", () => {
  const root = fixture();
  mutate(root, manifest.liveTest, (source) => source.replaceAll("rpc_only_browser_privileges", "removed_rpc_privileges_guard").replaceAll("rpc_only_browser_policies", "removed_rpc_policies_guard"));
  const result = auditStoreRlsSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "live_fail_closed_contract_missing"));
});
