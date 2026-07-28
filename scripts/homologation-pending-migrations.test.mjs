import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { inspectPendingMigrationPlan, renderPendingMigrationMarkdown } from "./homologation-pending-migrations.mjs";

const loadFixture = async () => {
  const plan = JSON.parse(await readFile("docs/evidence/homologation-pending-migrations-20260728.json", "utf8"));
  const snapshot = JSON.parse(await readFile("docs/evidence/homologation-migrations-20260727.json", "utf8"));
  return {
    plan,
    files: (await readdir("supabase/migrations")).filter((file) => file.endsWith(".sql")),
    remoteNames: snapshot.migrations.map((migration) => migration.name),
  };
};

test("plano real contém as 18 migrations em ordem e aguarda somente o dry-run", async () => {
  const { plan, files, remoteNames } = await loadFixture();
  const report = inspectPendingMigrationPlan(plan, files, remoteNames);
  assert.equal(report.structural_passed, true, report.errors.join("\n"));
  assert.equal(report.pending_count, 18);
  assert.equal(report.ready_for_apply, false);
  assert.deepEqual(report.apply_blockers, ["dry_run_pendente"]);
  assert.equal(plan.backup.confirmed, true);
  assert.equal(plan.required_repairs.every((repair) => repair.confirmed), true);
  assert.equal(report.pending_migrations[0].file, "20260728073000_cake_builder_configuration.sql");
  assert.equal(report.pending_migrations.at(-1).file, "20260728220000_unified_configurable_products.sql");
});

test("rejeita projeto diferente da homologação autorizada", async () => {
  const { plan, files, remoteNames } = await loadFixture();
  const report = inspectPendingMigrationPlan({ ...plan, project_id: "projeto-incorreto" }, files, remoteNames);
  assert.equal(report.structural_passed, false);
  assert.match(report.errors.join("\n"), /projeto de homologação inválido/);
});

test("rejeita aplicação parcial quando um arquivo planejado não existe", async () => {
  const { plan, files, remoteNames } = await loadFixture();
  const withoutProductCatalog = files.filter((file) => file !== "20260728220000_unified_configurable_products.sql");
  const report = inspectPendingMigrationPlan(plan, withoutProductCatalog, remoteNames);
  assert.equal(report.structural_passed, false);
  assert.deepEqual(report.missing_planned_files, ["20260728220000_unified_configurable_products.sql"]);
});

test("rejeita migration posterior que não esteja explicitamente no plano", async () => {
  const { plan, files, remoteNames } = await loadFixture();
  const report = inspectPendingMigrationPlan(plan, [...files, "20260728223000_nao_planejada.sql"], remoteNames);
  assert.equal(report.structural_passed, false);
  assert.deepEqual(report.unexpected_pending_files, ["20260728223000_nao_planejada.sql"]);
});

test("ignora drift local quando o nome já está representado no snapshot remoto", async () => {
  const { plan, files, remoteNames } = await loadFixture();
  const report = inspectPendingMigrationPlan(plan, [...files, "20260728230000_privacy_anonymization_preserve_member_code.sql"], remoteNames);
  assert.equal(report.structural_passed, true, report.errors.join("\n"));
  assert.deepEqual(report.unexpected_pending_files, []);
});

test("declara prontidão quando o dry-run é aprovado", async () => {
  const { plan, files, remoteNames } = await loadFixture();
  const readyPlan = {
    ...plan,
    dry_run: { ...plan.dry_run, status: "passed" },
  };
  const report = inspectPendingMigrationPlan(readyPlan, files, remoteNames);
  assert.equal(report.structural_passed, true);
  assert.equal(report.ready_for_apply, true);
  assert.deepEqual(report.apply_blockers, []);
  assert.match(renderPendingMigrationMarkdown(report), /Pronto para aplicação: \*\*sim\*\*/);
});
