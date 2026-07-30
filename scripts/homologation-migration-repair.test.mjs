import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertHomologationRepairContext,
  buildMigrationRepairCommands,
  loadMigrationRepairPlan,
  runHomologationMigrationRepairCli,
  validateMigrationRepairPlan,
} from "./homologation-migration-repair.mjs";

const projectId = "vazozolhbehnriytzcdc";

function validPlan() {
  return {
    schema_version: 1,
    environment: "homologation",
    project_id: projectId,
    status: "planned_not_applied",
    production_forbidden: true,
    decisions: [
      {
        name: "backend_only_tables_explicit_deny",
        keep_version: "20260727035116",
        revert_versions: ["20260727035059"],
        local_file: "20260727093000_backend_only_tables_explicit_deny.sql",
        target_file: "20260727035116_backend_only_tables_explicit_deny.sql",
      },
      {
        name: "operational_foreign_key_indexes",
        keep_version: "20260727035246",
        revert_versions: ["20260727035343"],
        local_file: "20260727095000_operational_foreign_key_indexes.sql",
        target_file: "20260727035246_operational_foreign_key_indexes.sql",
      },
    ],
  };
}

test("aceita somente plano explícito de homologação com produção bloqueada", () => {
  assert.equal(validateMigrationRepairPlan(validPlan()).project_id, projectId);

  assert.throws(
    () => validateMigrationRepairPlan({ ...validPlan(), environment: "production" }),
    /Somente o ambiente de homologação/,
  );
  assert.throws(
    () => validateMigrationRepairPlan({ ...validPlan(), production_forbidden: false }),
    /bloquear produção explicitamente/,
  );
  assert.throws(
    () => validateMigrationRepairPlan({ ...validPlan(), status: "applied" }),
    /planned_not_applied/,
  );
});

test("rejeita plano que tenta reverter a versão preservada ou repetir versão", () => {
  const sameVersion = validPlan();
  sameVersion.decisions[0].revert_versions = [sameVersion.decisions[0].keep_version];
  assert.throws(() => validateMigrationRepairPlan(sameVersion), /não pode ser revertida/);

  const repeatedVersion = validPlan();
  repeatedVersion.decisions[1].revert_versions = [
    repeatedVersion.decisions[0].revert_versions[0],
  ];
  assert.throws(() => validateMigrationRepairPlan(repeatedVersion), /repetida no plano/);
});

test("gera somente comandos oficiais migration repair reverted e vinculados", () => {
  const commands = buildMigrationRepairCommands(validateMigrationRepairPlan(validPlan()));
  assert.equal(commands.length, 2);
  for (const item of commands) {
    assert.deepEqual(item.command.slice(0, 5), [
      "npx",
      "--yes",
      "supabase@2.109.1",
      "migration",
      "repair",
    ]);
    assert.deepEqual(item.command.slice(-3), ["--status", "reverted", "--linked"]);
    assert.doesNotMatch(item.command.join(" "), /production|uefwywizqhfvvijaopcn/i);
  }
});

test("exige vínculo, refs separadas e confirmação exata antes da aplicação", () => {
  const plan = validateMigrationRepairPlan(validPlan());
  const base = {
    plan,
    linkedProjectRef: projectId,
    homologationProjectRef: projectId,
    productionProjectRef: "uefwywizqhfvvijaopcn",
    confirmation: `REPARAR SOMENTE HOMOLOGACAO ${projectId}`,
  };
  assert.equal(assertHomologationRepairContext(base), true);
  assert.throws(
    () =>
      assertHomologationRepairContext({
        ...base,
        linkedProjectRef: "uefwywizqhfvvijaopcn",
      }),
    /não está vinculado/,
  );
  assert.throws(
    () => assertHomologationRepairContext({ ...base, productionProjectRef: projectId }),
    /coincide com a homologação/,
  );
  assert.throws(
    () => assertHomologationRepairContext({ ...base, confirmation: "SIM" }),
    /Confirmação explícita/,
  );
});

test("modo padrão é dry-run e gera artefato redigido sem executar CLI", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "adoce-repair-"));
  const planPath = path.join(temporary, "plan.json");
  const outputDirectory = path.join(temporary, "artifacts");
  await writeFile(planPath, `${JSON.stringify(validPlan())}\n`, "utf8");

  const loaded = await loadMigrationRepairPlan(planPath);
  assert.equal(loaded.project_id, projectId);

  const report = await runHomologationMigrationRepairCli([
    "--plan",
    planPath,
    "--output-dir",
    outputDirectory,
  ]);
  assert.equal(report.mode, "dry-run");
  assert.equal(report.command_count, 2);
  const artifact = JSON.parse(
    await readFile(path.join(outputDirectory, "migration-repair-plan.json"), "utf8"),
  );
  assert.equal(artifact.production_forbidden, true);
  assert.equal(artifact.repairs.length, 2);
  assert.equal(JSON.stringify(artifact).includes("SUPABASE_DB_PASSWORD"), false);
  assert.equal(JSON.stringify(artifact).includes("SUPABASE_ACCESS_TOKEN"), false);
});

test("plano oficial contém somente os três repairs aprovados", async () => {
  const loaded = await loadMigrationRepairPlan(
    "docs/evidence/homologation-migration-repair-plan-20260727.json",
  );
  assert.deepEqual(
    buildMigrationRepairCommands(loaded).map((item) => item.version),
    ["20260727035059", "20260727035343", "20260727040533"],
  );
});

test("workflow manual bloqueia produção, valida escopo e preserva evidências", async () => {
  const workflow = await readFile(
    ".github/workflows/homologation-migration-repair.yml",
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /environment: homologation/);
  assert.match(workflow, /EXPECTED_BRANCH: reestruturacao\/ux-crm-operacao-imagens-v1/);
  assert.match(workflow, /test "\$HOMOLOGATION_REF" = "vazozolhbehnriytzcdc"/);
  assert.match(workflow, /test "\$PRODUCTION_REF" != "\$HOMOLOGATION_REF"/);
  assert.match(workflow, /REPARAR SOMENTE HOMOLOGACAO \$HOMOLOGATION_REF/);
  assert.match(workflow, /node scripts\/homologation-migration-repair\.mjs/);
  assert.match(workflow, /20260727035059/);
  assert.match(workflow, /20260727035343/);
  assert.match(workflow, /20260727040533/);
  assert.match(workflow, /history-before\.csv/);
  assert.match(workflow, /history-after\.csv/);
  assert.match(workflow, /--apply/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.doesNotMatch(workflow, /deploy --prod|release:prod|NETLIFY_PRODUCTION_SITE_ID/);
});
