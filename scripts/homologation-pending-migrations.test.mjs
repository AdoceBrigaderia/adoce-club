import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { inspectPendingMigrationPlan, renderPendingMigrationMarkdown } from "./homologation-pending-migrations.mjs";

const loadFixture = async () => {
  const plan = JSON.parse(await readFile("docs/evidence/homologation-pending-migrations-20260807.json", "utf8"));
  const snapshot = JSON.parse(await readFile("docs/evidence/homologation-migrations-20260807.json", "utf8"));
  return {
    plan,
    files: (await readdir("supabase/migrations")).filter((file) => file.endsWith(".sql")),
    remoteNames: snapshot.migrations.map((migration) => migration.name),
  };
};

test("baseline real está alinhada e não declara migrations pendentes", async () => {
  const { plan, files, remoteNames } = await loadFixture();
  const report = inspectPendingMigrationPlan(plan, files, remoteNames);
  assert.equal(report.structural_passed, true, report.errors.join("\n"));
  assert.equal(report.pending_count, 0);
  assert.equal(report.ready_for_apply, true);
  assert.deepEqual(report.apply_blockers, []);
  assert.equal(plan.backup.confirmed, true);
  assert.equal(plan.required_repairs.every((repair) => repair.confirmed), true);
  assert.deepEqual(report.pending_migrations, []);
});

test("rejeita projeto diferente da homologação autorizada", async () => {
  const { plan, files, remoteNames } = await loadFixture();
  const report = inspectPendingMigrationPlan({ ...plan, project_id: "projeto-incorreto" }, files, remoteNames);
  assert.equal(report.structural_passed, false);
  assert.match(report.errors.join("\n"), /projeto de homologação inválido/);
});

test("rejeita baseline alinhada que declara uma migration pendente", async () => {
  const { plan, files, remoteNames } = await loadFixture();
  const report = inspectPendingMigrationPlan({ ...plan, pending_migrations: [{ version: "20260808000000", name: "teste", stage: "test" }] }, files, remoteNames);
  assert.equal(report.structural_passed, false);
  assert.match(report.errors.join("\n"), /baseline alinhada não pode declarar pendências/);
});

test("rejeita migration posterior que não esteja explicitamente no plano", async () => {
  const { plan, files, remoteNames } = await loadFixture();
  const report = inspectPendingMigrationPlan(plan, [...files, "20260809000000_nao_planejada.sql"], remoteNames);
  assert.equal(report.structural_passed, false);
  assert.deepEqual(report.unexpected_pending_files, ["20260809000000_nao_planejada.sql"]);
});

test("ignora drift local quando o nome já está representado no snapshot remoto", async () => {
  const { plan, files, remoteNames } = await loadFixture();
  const report = inspectPendingMigrationPlan(plan, [...files, "20260809000000_privacy_anonymization_preserve_member_code.sql"], remoteNames);
  assert.equal(report.structural_passed, true, report.errors.join("\n"));
  assert.deepEqual(report.unexpected_pending_files, []);
});

test("exige dry-run se uma baseline de aplicação declara pendências", async () => {
  const { plan, files, remoteNames } = await loadFixture();
  const readyPlan = {
    ...plan,
    baseline_status: "pending_apply",
    pending_migrations: [{ version: "20260809000000", name: "teste", stage: "test" }],
    dry_run: { ...plan.dry_run, status: "passed" },
  };
  const report = inspectPendingMigrationPlan(readyPlan, ["20260809000000_teste.sql"], remoteNames);
  assert.equal(report.structural_passed, true, report.errors.join("\n"));
  assert.equal(report.ready_for_apply, true);
  assert.deepEqual(report.apply_blockers, []);
  assert.match(renderPendingMigrationMarkdown(report), /Pronto para aplicação: \*\*sim\*\*/);
});
