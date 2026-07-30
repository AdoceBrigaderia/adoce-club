import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildBackupManifest, manifestMarkdown } from "./homologation-backup-manifest.mjs";

const files = [
  "roles.sql",
  "schema.sql",
  "data.sql",
  "history_schema.sql",
  "history_data.sql",
  "history.csv",
];

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), "adoce-backup-"));
  for (const file of files) await writeFile(join(directory, file), `conteudo-${file}\n`);
  return directory;
}

test("gera manifesto com hashes e separa o Storage", async () => {
  const directory = await createFixture();
  try {
    const manifest = await buildBackupManifest({
      directory,
      project: "vazozolhbehnriytzcdc",
      commit: "a".repeat(40),
      createdAt: "2026-07-28T18:00:00Z",
      label: "backup-001",
    });
    assert.equal(manifest.database_backup.files.length, 6);
    assert.equal(manifest.storage_backup.included, false);
    assert.equal(manifest.production.altered, false);
    for (const file of manifest.database_backup.files) {
      assert.match(file.sha256, /^[0-9a-f]{64}$/);
      assert.ok(file.bytes > 0);
    }
    const markdown = manifestMarkdown(manifest);
    assert.match(markdown, /Produção: não acessada e não alterada/);
    assert.match(markdown, /Storage não estão incluídos/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejeita projeto diferente e commit incompleto", async () => {
  const directory = await createFixture();
  try {
    await assert.rejects(
      buildBackupManifest({ directory, project: "projeto-invalido", commit: "a".repeat(40) }),
      /exclusivamente o projeto de homologação/,
    );
    await assert.rejects(
      buildBackupManifest({ directory, project: "vazozolhbehnriytzcdc", commit: "abc" }),
      /SHA completo/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejeita arquivo obrigatório vazio", async () => {
  const directory = await createFixture();
  try {
    await writeFile(join(directory, "data.sql"), "");
    await assert.rejects(
      buildBackupManifest({ directory, project: "vazozolhbehnriytzcdc", commit: "b".repeat(40) }),
      /vazio ou inválido: data.sql/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
