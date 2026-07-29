import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertRpcSurface, auditRpcSurface } from "./rpc-surface-audit-core.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const controlledFiles = [
  "security/rpc-surface.json",
  "netlify/functions/_shared/bff-rpc-policy.ts",
  "supabase/tests/authenticated_rpc_allowlist_live.sql",
  "supabase/migrations/20260729120500_lock_superseded_rpc_versions.sql",
];

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "adoce-rpc-surface-"));
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

test("aprova a superfície RPC versionada do repositório", () => {
  const result = assertRpcSurface(repositoryRoot);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.operationBffCount, 67);
  assert.equal(result.clientBffCount, 3);
  assert.equal(result.dedicatedAuthenticatedCount, 10);
  assert.equal(result.publicCompatibilityAuthenticatedCount, 3);
  assert.equal(result.authenticatedCount, 83);
  assert.equal(result.anonymousCount, 2);
  assert.equal(result.transactionVersionPairCount, 3);
  assert.deepEqual(result.violations, []);
});

test("reprova drift entre manifesto e allowlist operacional do BFF", () => {
  const root = fixture();
  mutate(root, "netlify/functions/_shared/bff-rpc-policy.ts", (source) =>
    source.replace('  "staff_get_business_workspace",\n', ""),
  );
  const result = auditRpcSurface(root);
  assert.ok(result.violations.some(({ code }) => code === "operation_policy_drift"));
  assert.throws(() => assertRpcSurface(root), /operation_policy_drift/);
});

test("reprova RPC autenticada inesperada no ensaio vivo", () => {
  const root = fixture();
  mutate(root, "supabase/tests/authenticated_rpc_allowlist_live.sql", (source) =>
    source.replace("allowed text[] := array[", "allowed text[] := array[\n    'rogue_rpc',"),
  );
  const result = auditRpcSurface(root);
  assert.ok(
    result.violations.some(({ code, detail }) =>
      code === "authenticated_live_allowlist_drift" && detail.includes("rogue_rpc"),
    ),
  );
});

test("reprova exposição anônima fora da categoria pública compatível", () => {
  const root = fixture();
  mutate(root, "security/rpc-surface.json", (source) => {
    const manifest = JSON.parse(source);
    manifest.anonymous.push("rogue_rpc");
    return `${JSON.stringify(manifest, null, 2)}\n`;
  });
  const result = auditRpcSurface(root);
  assert.ok(
    result.violations.some(({ code }) => code === "anonymous_outside_public_compatibility"),
  );
  assert.ok(
    result.violations.some(({ code }) => code === "anonymous_live_allowlist_drift"),
  );
});

test("reprova duplicidade entre categorias autenticadas", () => {
  const root = fixture();
  mutate(root, "security/rpc-surface.json", (source) => {
    const manifest = JSON.parse(source);
    manifest.clientBff.push(manifest.operationBff[0]);
    return `${JSON.stringify(manifest, null, 2)}\n`;
  });
  const result = auditRpcSurface(root);
  assert.ok(
    result.violations.some(({ code }) => code === "manifest_cross_category_duplicates"),
  );
});

test("reprova versão transacional sem wiring na migration", () => {
  const root = fixture();
  mutate(
    root,
    "supabase/migrations/20260729120500_lock_superseded_rpc_versions.sql",
    (source) => source.replaceAll("'submit_instant_order_v5'", "'removed_version'"),
  );
  const result = auditRpcSurface(root);
  assert.ok(
    result.violations.some(
      ({ code, detail }) =>
        code === "transaction_version_not_wired" && detail.includes("submit_instant_order_v5"),
    ),
  );
});
