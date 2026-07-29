import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertOrderTableSurface, auditOrderTableSurface } from "./order-table-surface-audit-core.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestFile = "security/order-table-surface.json";
const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, manifestFile), "utf8"));
const controlledFiles = [
  manifestFile,
  manifest.liveTest,
  manifest.lockMigration,
  manifest.workflow,
  ...manifest.tables.map(({ definitionMigration }) => definitionMigration),
  ...manifest.tables.flatMap(({ scopeEvidence = [] }) => scopeEvidence.map(({ migration }) => migration)),
  ...manifest.tables.flatMap(({ historicalPolicies = [] }) => historicalPolicies.map(({ migration }) => migration)),
].filter((value, index, values) => values.indexOf(value) === index);

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "adoce-order-table-surface-"));
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

test("aprova a superfície RPC-only dos pedidos imediatos", () => {
  const result = assertOrderTableSurface(repositoryRoot);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.tableCount, 2);
  assert.equal(result.historicalPolicyCount, 2);
  assert.equal(result.scopeEvidenceCount, 1);
  assert.deepEqual(result.violations, []);
});

test("mantém a auditoria conectada aos gates locais", () => {
  const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["test:order-table-surface"], "node --test scripts/order-table-surface-audit-core.test.mjs");
  assert.equal(packageJson.scripts["audit:order-table-surface"], "node scripts/audit-order-table-surface.mjs");
  for (const gate of ["verify:fast", "verify"]) {
    assert.match(packageJson.scripts[gate], /npm run test:order-table-surface/);
    assert.match(packageJson.scripts[gate], /npm run audit:order-table-surface/);
  }
});

test("reprova drift entre manifesto, migration e ensaio vivo", () => {
  const root = fixture();
  mutate(root, manifest.liveTest, (source) => source.replace("    'instant_order_items'\n", ""));
  const result = auditOrderTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "live_inventory_drift"));
});

test("reprova retorno do acesso direto autenticado", () => {
  const root = fixture();
  mutate(root, manifest.lockMigration, (source) => source.replace("from public, anon, authenticated;", "from public, anon;"));
  const result = auditOrderTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "lock_contract_missing"));
});

test("reprova policy histórica sem limpeza no lockdown", () => {
  const root = fixture();
  mutate(root, manifest.lockMigration, (source) => source.replace(
    "drop policy if exists instant_orders_staff_all on public.instant_orders;",
    "-- limpeza removida pelo teste",
  ));
  const result = auditOrderTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "historical_policy_cleanup_missing"));
});

test("reprova perda da evidência de escopo da loja", () => {
  const root = fixture();
  const migration = "supabase/migrations/20260726124842_business_structure_and_cash.sql";
  mutate(root, migration, (source) => source.replace(
    "add column if not exists store_id uuid references public.stores(id)",
    "add column if not exists removed_store_scope uuid",
  ));
  const result = auditOrderTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "scope_evidence_contract_missing"));
});

test("reprova item que perde a filiação ao pedido", () => {
  const root = fixture();
  const migration = "supabase/migrations/20260722172238_instant_orders_and_pickup.sql";
  mutate(root, migration, (source) => source.replace(
    "order_id uuid not null references public.instant_orders(id)",
    "order_id uuid not null",
  ));
  const result = auditOrderTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "parent_scope_contract_missing"));
});

test("reprova referência histórica que não cria a policy declarada", () => {
  const root = fixture();
  const migration = "supabase/migrations/20260722172238_instant_orders_and_pickup.sql";
  mutate(root, migration, (source) => source.replace(
    "create policy instant_order_items_staff_all",
    "create policy renamed_instant_order_items_policy",
  ));
  const result = auditOrderTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "historical_policy_contract_missing"));
});

test("reprova workflow automático ou mutável", () => {
  const root = fixture();
  mutate(root, manifest.workflow, (source) => `${source}\n  push:\n    branches: [main]\n# supabase db push\n`);
  const result = auditOrderTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "workflow_automatic_trigger_forbidden"));
  assert.ok(result.violations.some(({ code }) => code === "workflow_mutation_forbidden"));
  assert.throws(() => assertOrderTableSurface(root), /Auditoria da superfície RPC dos pedidos reprovada/);
});
