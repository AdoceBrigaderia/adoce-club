import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { inspectPendingMigrationPlan, renderPendingMigrationMarkdown } from "./homologation-pending-migrations.mjs";

const loadFixture = async () => ({
  plan: JSON.parse(await readFile("docs/evidence/homologation-pending-migrations-20260728.json", "utf8")),
  files: (await readdir("supabase/migrations")).filter((file) => file.endsWith(".sql")),
});

test("plano real contém as 17 migrations pendentes em ordem e permanece bloqueado", async () => {
  const { plan, files } = await loadFixture();
  const report = inspectPendingMigrationPlan(plan, files);
  assert.equal(report.structural_passed, true, report.errors.join("\n"));
  assert.equal(report.pending_count, 17);
  assert.equal(report.ready_for_apply, false);
  assert.deepEqual(report.apply_blockers, ["backup_nao_confirmado", "repairs_pendentes", "dry_run_pendente"]);
  assert.equal(report.pending_migrations[0].file, "20260728073000_cake_builder_configuration.sql");
  assert.equal(report.pending_migrations.at(-1).file, "20260728174500_gallery_media_assets_bff.sql");
});

test("rejeita projeto diferente da homologação autorizada", async () => {
  const { plan, files } = await loadFixture();
  const report = inspectPendingMigrationPlan({ ...plan, project_id: "projeto-incorreto" }, files);
  assert.equal(report.structural_passed, false);
  assert.match(report.errors.join("\n"), /projeto de homologação inválido/);
});

test("rejeita aplicação parcial quando um arquivo planejado não existe", async () => {
  const { plan, files } = await loadFixture();
  const withoutFestival = files.filter((file) => file !== "20260728170246_festival_slice_yield_overrides.sql");
  const report = inspectPendingMigrationPlan(plan, withoutFestival);
  assert.equal(report.structural_passed, false);
  assert.deepEqual(report.missing_planned_files, ["20260728170246_festival_slice_yield_overrides.sql"]);
});

test("rejeita migration posterior que não esteja explicitamente no plano", async () => {
  const { plan, files } = await loadFixture();
  const report = inspectPendingMigrationPlan(plan, [...files, "20260728180000_nao_planejada.sql"]);
  assert.equal(report.structural_passed, false);
  assert.deepEqual(report.unexpected_pending_files, ["20260728180000_nao_planejada.sql"]);
});

test("só declara prontidão quando backup, repairs e dry-run estão confirmados", async () => {
  const { plan, files } = await loadFixture();
  const readyPlan = {
    ...plan,
    backup: { ...plan.backup, confirmed: true, status: "confirmed" },
    required_repairs: plan.required_repairs.map((repair) => ({ ...repair, confirmed: true })),
    dry_run: { ...plan.dry_run, status: "passed" },
  };
  const report = inspectPendingMigrationPlan(readyPlan, files);
  assert.equal(report.structural_passed, true);
  assert.equal(report.ready_for_apply, true);
  assert.deepEqual(report.apply_blockers, []);
  assert.match(renderPendingMigrationMarkdown(report), /Pronto para aplicação: \*\*sim\*\*/);
});
