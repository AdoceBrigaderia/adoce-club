import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { auditOperationalReportSurface } from "./operational-report-surface-audit-core.mjs";

const controlled = [
  "security/operational-report-surface.json",
  "supabase/migrations/20260729223000_harden_operational_reports_by_store_and_finance.sql",
  "supabase/migrations/20260729224500_add_operational_report_breakdowns.sql",
  "supabase/tests/operational_reports_boundary_live.sql",
  ".github/workflows/operational-reports-boundary-live-homologation.yml",
];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "adoce-report-surface-"));
  for (const file of controlled) {
    const target = join(root, file);
    cpSync(resolve(file), target, { recursive: true });
  }
  return root;
}

function mutate(root, file, search, replacement = "") {
  const target = join(root, file);
  const source = readFileSync(target, "utf8");
  assert.ok(source.includes(search), `fixture não contém ${search}`);
  writeFileSync(target, source.replace(search, replacement));
}

test("aprova a fronteira versionada dos relatórios", () => {
  const result = auditOperationalReportSurface(process.cwd());
  assert.equal(result.violations.length, 0);
  assert.equal(result.breakdownCount, 4);
  assert.ok(result.protectedFinancialFieldCount >= 10);
});

test("reprova perda da redação financeira", () => {
  const root = fixture();
  try {
    mutate(root, controlled[1], "finance_scope_complete", "finance_scope_removed");
    assert.ok(auditOperationalReportSurface(root).violations.some((item) => item.code === "base_contract_missing"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reprova retorno do acesso à função interna", () => {
  const root = fixture();
  try {
    mutate(root, controlled[2], "from public, anon, authenticated, service_role;", "from public, anon;");
    assert.ok(auditOperationalReportSurface(root).violations.some((item) => item.code === "breakdown_contract_missing"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reprova perda de um detalhamento", () => {
  const root = fixture();
  try {
    const manifest = JSON.parse(readFileSync(join(root, controlled[0]), "utf8"));
    manifest.breakdowns.pop();
    writeFileSync(join(root, controlled[0]), `${JSON.stringify(manifest, null, 2)}\n`);
    assert.ok(auditOperationalReportSurface(root).violations.some((item) => item.code === "manifest_array_drift"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reprova perda do contrato viewer", () => {
  const root = fixture();
  try {
    mutate(root, controlled[3], "Viewer recebeu valores financeiros no relatório", "viewer sem contrato");
    assert.ok(auditOperationalReportSurface(root).violations.some((item) => item.code === "live_contract_missing"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reprova gatilho automático no workflow vivo", () => {
  const root = fixture();
  try {
    mutate(root, controlled[4], "  workflow_dispatch:", "  push:\n  workflow_dispatch:");
    assert.ok(auditOperationalReportSurface(root).violations.some((item) => item.code === "workflow_trigger_forbidden"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
