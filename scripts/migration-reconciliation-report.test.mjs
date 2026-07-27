import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  inspectMigrationReconciliation,
  loadRemoteMigrationSnapshot,
  readLocalMigrationInventory,
  renderMigrationReconciliationMarkdown,
  writeMigrationReconciliationReport,
} from "./migration-reconciliation-report.mjs";

async function fixture(localFiles, remoteMigrations) {
  const root = await mkdtemp(path.join(os.tmpdir(), "adoce-reconcile-"));
  const migrations = path.join(root, "migrations");
  const snapshotPath = path.join(root, "snapshot.json");
  await mkdir(migrations);
  for (const [name, content] of Object.entries(localFiles)) {
    await writeFile(path.join(migrations, name), content, "utf8");
  }
  await writeFile(
    snapshotPath,
    JSON.stringify({
      schema_version: 1,
      environment: "homologation",
      project_id: "homolog-test",
      captured_at: "2026-07-27T15:55:00-03:00",
      migrations: remoteMigrations,
    }),
    "utf8",
  );
  return { root, migrations, snapshotPath };
}

async function inspect(localFiles, remoteMigrations) {
  const data = await fixture(localFiles, remoteMigrations);
  const local = await readLocalMigrationInventory(data.migrations);
  const snapshot = await loadRemoteMigrationSnapshot(data.snapshotPath);
  return { ...data, report: inspectMigrationReconciliation(local, snapshot) };
}

test("aprova histórico local e remoto com versões idênticas", async () => {
  const { report } = await inspect(
    {
      "20260727080000_primeira.sql": "select 'SEGREDO_A';",
      "20260727080100_segunda.sql": "select 'SEGREDO_B';",
    },
    [
      { version: "20260727080000", name: "primeira" },
      { version: "20260727080100", name: "segunda" },
    ],
  );

  assert.equal(report.passed, true);
  assert.equal(report.safe_to_apply_rename_plan, true);
  assert.equal(report.aligned_count, 2);
  assert.deepEqual(report.rename_candidates, []);
});

test("gera plano de renomeação sem copiar conteúdo SQL", async () => {
  const { report } = await inspect(
    {
      "20260727080000_primeira.sql": "select 'CONTEUDO_ULTRASSECRETO';",
    },
    [{ version: "20260727081234", name: "primeira" }],
  );

  assert.equal(report.passed, false);
  assert.equal(report.safe_to_apply_rename_plan, true);
  assert.deepEqual(report.rename_candidates, [
    {
      file: "20260727080000_primeira.sql",
      name: "primeira",
      local_version: "20260727080000",
      remote_version: "20260727081234",
      suggested_filename: "20260727081234_primeira.sql",
    },
  ]);
  const serialized = JSON.stringify(report) + renderMigrationReconciliationMarkdown(report);
  assert.doesNotMatch(serialized, /CONTEUDO_ULTRASSECRETO/);
});

test("bloqueia plano automático quando o histórico remoto repete um nome", async () => {
  const { report } = await inspect(
    {
      "20260727080000_primeira.sql": "select 1;",
    },
    [
      { version: "20260727081234", name: "primeira" },
      { version: "20260727081235", name: "primeira" },
    ],
  );

  assert.equal(report.passed, false);
  assert.equal(report.safe_to_apply_rename_plan, false);
  assert.deepEqual(report.remote_duplicate_names, [
    {
      name: "primeira",
      versions: ["20260727081234", "20260727081235"],
    },
  ]);
  assert.deepEqual(report.ambiguous_remote, [
    {
      file: "20260727080000_primeira.sql",
      local_version: "20260727080000",
      name: "primeira",
      remote_versions: ["20260727081234", "20260727081235"],
    },
  ]);
});

test("detecta versões locais duplicadas e migrations sem correspondente remoto", async () => {
  const { report } = await inspect(
    {
      "20260727080000_primeira.sql": "select 1;",
      "20260727080000_segunda.sql": "select 2;",
      "20260727090000_sem_remoto.sql": "select 3;",
    },
    [
      { version: "20260727081234", name: "primeira" },
      { version: "20260727081235", name: "segunda" },
    ],
  );

  assert.equal(report.passed, false);
  assert.deepEqual(report.local_duplicate_versions, [
    {
      version: "20260727080000",
      files: [
        "20260727080000_primeira.sql",
        "20260727080000_segunda.sql",
      ],
    },
  ]);
  assert.deepEqual(report.missing_remote, [
    {
      file: "20260727090000_sem_remoto.sql",
      local_version: "20260727090000",
      name: "sem_remoto",
    },
  ]);
});

test("grava artefatos redigidos em JSON e Markdown", async () => {
  const { root, report } = await inspect(
    {
      "20260727080000_primeira.sql": "select 'NAO_PUBLICAR';",
    },
    [{ version: "20260727081234", name: "primeira" }],
  );
  const output = path.join(root, "artifacts");
  const files = await writeMigrationReconciliationReport(report, output);
  const json = await readFile(files.jsonPath, "utf8");
  const markdown = await readFile(files.markdownPath, "utf8");

  assert.match(json, /"version_drift_count": 1/);
  assert.match(markdown, /Plano de renomeação por nome canônico/);
  assert.doesNotMatch(`${json}${markdown}`, /NAO_PUBLICAR/);
});
