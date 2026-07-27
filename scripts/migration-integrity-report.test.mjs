import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  inspectMigrationDirectory,
  renderMigrationIntegrityMarkdown,
  writeMigrationIntegrityReport,
} from "./migration-integrity-report.mjs";

async function fixture(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "adoce-migrations-"));
  const migrations = path.join(root, "migrations");
  await mkdir(migrations);
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(migrations, name), content, "utf8");
  }
  return { root, migrations };
}

test("aprova timestamps únicos e nomes canônicos", async () => {
  const { migrations } = await fixture({
    "20260727080000_primeira.sql": "select 'segredo-a';",
    "20260727080100_segunda_etapa.sql": "select 'segredo-b';",
  });
  const report = await inspectMigrationDirectory(migrations);
  assert.equal(report.passed, true);
  assert.equal(report.total_files, 2);
  assert.equal(report.unique_versions, 2);
  assert.deepEqual(report.invalid_files, []);
  assert.deepEqual(report.duplicate_versions, []);
});

test("detecta versões duplicadas sem ler ou expor SQL", async () => {
  const { migrations } = await fixture({
    "20260727080000_primeira.sql": "select 'CONTEUDO_SENSIVEL_A';",
    "20260727080000_segunda.sql": "select 'CONTEUDO_SENSIVEL_B';",
  });
  const report = await inspectMigrationDirectory(migrations);
  assert.equal(report.passed, false);
  assert.deepEqual(report.duplicate_versions, [
    {
      version: "20260727080000",
      files: [
        "20260727080000_primeira.sql",
        "20260727080000_segunda.sql",
      ],
    },
  ]);
  const serialized = JSON.stringify(report) + renderMigrationIntegrityMarkdown(report);
  assert.doesNotMatch(serialized, /CONTEUDO_SENSIVEL/);
});

test("detecta nomes fora do padrão de 14 dígitos", async () => {
  const { migrations } = await fixture({
    "001_legado.sql": "select 1;",
    "20260727080000_valida.sql": "select 2;",
  });
  const report = await inspectMigrationDirectory(migrations);
  assert.equal(report.passed, false);
  assert.deepEqual(report.invalid_files, ["001_legado.sql"]);
});

test("grava artefatos redigidos em JSON e Markdown", async () => {
  const { root, migrations } = await fixture({
    "20260727080000_unica.sql": "select 'NUNCA_PUBLICAR';",
  });
  const report = await inspectMigrationDirectory(migrations);
  const output = path.join(root, "artifacts");
  const paths = await writeMigrationIntegrityReport(report, output);
  const json = await readFile(paths.jsonPath, "utf8");
  const markdown = await readFile(paths.markdownPath, "utf8");
  assert.match(json, /"passed": true/);
  assert.match(markdown, /Resultado: \*\*aprovado\*\*/);
  assert.doesNotMatch(`${json}${markdown}`, /NUNCA_PUBLICAR/);
});
