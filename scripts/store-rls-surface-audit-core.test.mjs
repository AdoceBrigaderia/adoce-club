import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertStoreRlsSurface,
  auditStoreRlsSurface,
} from "./store-rls-surface-audit-core.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const controlledFiles = [
  "security/store-rls-surface.json",
  "supabase/tests/store_rls_boundary_live.sql",
  "supabase/migrations/20260729155500_lock_store_scoped_table_writes.sql",
  ".github/workflows/store-rls-boundary-live-homologation.yml",
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
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.tableCount, 5);
  assert.equal(result.predicateCount, 6);
  assert.deepEqual(result.violations, []);
});

test("mantém auditoria RLS conectada aos dois gates locais", () => {
  const packageJson = JSON.parse(
    readFileSync(resolve(repositoryRoot, "package.json"), "utf8"),
  );
  assert.equal(
    packageJson.scripts["test:store-rls-surface"],
    "node --test scripts/store-rls-surface-audit-core.test.mjs",
  );
  assert.equal(
    packageJson.scripts["audit:store-rls-surface"],
    "node scripts/audit-store-rls-surface.mjs",
  );
  for (const gate of ["verify:fast", "verify"]) {
    assert.match(packageJson.scripts[gate], /npm run test:store-rls-surface/);
    assert.match(packageJson.scripts[gate], /npm run audit:store-rls-surface/);
  }
});

test("reprova drift entre manifesto, ensaio vivo e migration", () => {
  const root = fixture();
  mutate(root, "supabase/tests/store_rls_boundary_live.sql", (source) =>
    source.replace("    'cash_movements'\n", ""),
  );
  const result = auditStoreRlsSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "live_table_inventory_drift"));
  assert.throws(() => assertStoreRlsSurface(root), /live_table_inventory_drift/);
});

test("reprova perda de predicado de isolamento por loja", () => {
  const root = fixture();
  mutate(root, "supabase/tests/store_rls_boundary_live.sql", (source) =>
    source.replace(
      "position('private.can_access_store(id)'",
      "position('true'",
    ),
  );
  const result = auditStoreRlsSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "live_read_predicate_missing"));
});

test("reprova retorno de policies de escrita autenticada", () => {
  const root = fixture();
  mutate(root, "supabase/tests/store_rls_boundary_live.sql", (source) =>
    source.replaceAll("authenticated_write_policies", "removed_write_policy_guard"),
  );
  const result = auditStoreRlsSurface(root);
  assert.ok(
    result.violations.some(({ code }) => code === "live_fail_closed_contract_missing"),
  );
});

test("reprova migration que perde o corte de escrita direta", () => {
  const root = fixture();
  mutate(
    root,
    "supabase/migrations/20260729155500_lock_store_scoped_table_writes.sql",
    (source) => source.replace("from public, anon, authenticated", "from authenticated"),
  );
  const result = auditStoreRlsSurface(root);
  assert.ok(
    result.violations.some(({ code }) => code === "write_lock_migration_contract_missing"),
  );
});

test("reprova execução viva automática ou mutável", () => {
  const root = fixture();
  mutate(
    root,
    ".github/workflows/store-rls-boundary-live-homologation.yml",
    (source) => `${source}\n  push:\n    branches: [main]\n# supabase db push\n`,
  );
  const result = auditStoreRlsSurface(root);
  assert.ok(
    result.violations.some(({ code }) => code === "workflow_automatic_trigger_forbidden"),
  );
  assert.ok(result.violations.some(({ code }) => code === "workflow_mutation_forbidden"));
});
