import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertServiceRequestTableSurface,
  auditServiceRequestTableSurface,
} from "./service-request-table-surface-audit-core.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestFile = "security/service-request-table-surface.json";
const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, manifestFile), "utf8"));
const controlledFiles = [
  manifestFile,
  manifest.liveTest,
  manifest.lockMigration,
  manifest.hardeningMigration,
  manifest.workspaceHardeningMigration,
  manifest.workflow,
  ...manifest.tables.map(({ definitionMigration }) => definitionMigration).filter(Boolean),
  ...manifest.tables.flatMap(({ definitionEvidence = [] }) =>
    definitionEvidence.map(({ migration }) => migration),
  ),
].filter((value, index, values) => values.indexOf(value) === index);

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "adoce-service-request-surface-"));
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

test("aprova a superfície RPC-only das encomendas e snapshots", () => {
  const result = assertServiceRequestTableSurface(repositoryRoot);
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.tableCount, 4);
  assert.equal(result.parentScopedTableCount, 3);
  assert.equal(result.evidenceCount, 4);
  assert.deepEqual(result.violations, []);
});

test("mantém a auditoria conectada aos gates locais", () => {
  const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["test:service-request-table-surface"],
    "node --test scripts/service-request-table-surface-audit-core.test.mjs",
  );
  assert.equal(
    packageJson.scripts["audit:service-request-table-surface"],
    "node scripts/audit-service-request-table-surface.mjs",
  );
  for (const gate of ["verify:fast", "verify"]) {
    assert.match(packageJson.scripts[gate], /npm run test:service-request-table-surface/);
    assert.match(packageJson.scripts[gate], /npm run audit:service-request-table-surface/);
  }
});

test("reprova drift entre manifesto, migration e ensaio vivo", () => {
  const root = fixture();
  mutate(root, manifest.liveTest, (source) =>
    source.replace("    'service_request_pricing_snapshots'\n", ""),
  );
  const result = auditServiceRequestTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "live_inventory_drift"));
});

test("reprova retorno de privilégio autenticado", () => {
  const root = fixture();
  mutate(root, manifest.lockMigration, (source) =>
    source.replace("from public, anon, authenticated;", "from public, anon;"),
  );
  const result = auditServiceRequestTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "lock_table_revoke_missing"));
});

test("reprova remoção do escopo direto da loja", () => {
  const root = fixture();
  mutate(root, manifest.lockMigration, (source) =>
    source.replace(
      "add column if not exists store_id uuid references public.stores(id) on delete restrict",
      "add column if not exists removed_store_scope uuid",
    ),
  );
  const result = auditServiceRequestTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "lock_contract_missing"));
});

test("reprova perda da filiação de snapshot à encomenda", () => {
  const root = fixture();
  const migration = "supabase/migrations/20260728130000_service_request_pricing_snapshots.sql";
  mutate(root, migration, (source) =>
    source.replace(
      "request_id uuid primary key references public.service_requests(id)",
      "request_id uuid primary key",
    ),
  );
  const result = auditServiceRequestTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "parent_scope_contract_missing"));
});

test("reprova retorno de consulta operacional sem capacidade por loja", () => {
  const root = fixture();
  mutate(root, manifest.lockMigration, (source) =>
    source.replaceAll("private.staff_has_capability(request.store_id, 'manage_orders')", "true"),
  );
  const result = auditServiceRequestTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "lock_contract_missing"));
});

test("reprova perda do filtro do CRM por loja", () => {
  const root = fixture();
  mutate(root, manifest.lockMigration, (source) =>
    source.replace("private.staff_has_capability(request.store_id, 'manage_customers')", "true"),
  );
  const result = auditServiceRequestTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "lock_contract_missing"));
});

test("exige FKs exatas e assinaturas com loja no pós-gate SQL", () => {
  const migration = readFileSync(resolve(repositoryRoot, manifest.lockMigration), "utf8");
  const liveTest = readFileSync(resolve(repositoryRoot, manifest.liveTest), "utf8");
  for (const source of [migration, liveTest]) {
    assert.match(source, /column_info\.column_name = 'store_id'/);
    assert.match(source, /join lateral unnest\(constraint_info\.conkey\)/);
    assert.match(source, /child_column\.attname = 'request_id'/);
    assert.match(source, /parent_table\.relname = 'service_requests'/);
  }
  assert.match(liveTest, /submit_service_request_bff lost the store-scoped signature/);
  assert.match(liveTest, /staff_get_service_request_workspace lost the store filter signature/);
});

test("reprova perda do hardening diferido ou reexposição dos RPCs internos", () => {
  const root = fixture();
  mutate(root, manifest.hardeningMigration, (source) =>
    source
      .replace("deferrable initially deferred", "not deferrable")
      .replaceAll("from public, anon, authenticated, service_role;", "from public, anon, authenticated;"),
  );
  const result = auditServiceRequestTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "hardening_contract_missing"));
});

test("reprova retorno da varredura global ou perda do teto financeiro", () => {
  const root = fixture();
  mutate(root, manifest.workspaceHardeningMigration, (source) =>
    source
      .replace(
        "join public.stores store on store.id = request.store_id",
        "join public.stores store on store.id is not null",
      )
      .replaceAll(
        "private.staff_has_capability(request.store_id, 'view_finance')",
        "private.is_manager()",
      )
      .replace(
        "from public.service_requests request",
        "from public.staff_get_service_request_workspace_unscoped_internal('', null, 80) request",
      ),
  );
  const result = auditServiceRequestTableSurface(root);
  assert.ok(
    result.violations.some(({ code }) =>
      ["workspace_hardening_contract_missing", "workspace_unscoped_call_forbidden"].includes(code),
    ),
  );
});

test("reprova remoção da migration final do manifesto", () => {
  const root = fixture();
  mutate(root, manifestFile, (source) =>
    source.replace(/\s*"workspaceHardeningMigration":\s*"[^"]+",?\n/, "\n"),
  );
  const result = auditServiceRequestTableSurface(root);
  assert.ok(
    result.violations.some(({ code }) =>
      ["manifest_path_invalid", "workspace_hardening_migration_missing"].includes(code),
    ),
  );
});

test("reprova workflow automático ou mutável", () => {
  const root = fixture();
  mutate(root, manifest.workflow, (source) =>
    `${source}\n  push:\n    branches: [main]\n# supabase db push\n`,
  );
  const result = auditServiceRequestTableSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "workflow_automatic_trigger_forbidden"));
  assert.ok(result.violations.some(({ code }) => code === "workflow_mutation_forbidden"));
  assert.throws(
    () => assertServiceRequestTableSurface(root),
    /Auditoria da superfície RPC das encomendas reprovada/,
  );
});
