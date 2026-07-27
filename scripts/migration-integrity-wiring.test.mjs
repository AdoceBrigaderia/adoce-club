import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("liga o relatório aos comandos e bloqueia produção em modo estrito", async () => {
  const packageSource = JSON.parse(await read("package.json"));
  assert.equal(
    packageSource.scripts["test:migration-integrity"],
    "node --test scripts/migration-integrity-report.test.mjs scripts/migration-integrity-wiring.test.mjs",
  );
  assert.equal(
    packageSource.scripts["report:migration-integrity"],
    "node scripts/migration-integrity-report.mjs",
  );
  assert.equal(
    packageSource.scripts["audit:migrations"],
    "node scripts/migration-integrity-report.mjs --strict",
  );
  assert.match(packageSource.scripts["release:prod"], /audit:migrations/);
});

test("preserva o diagnóstico redigido no workflow de homologação", async () => {
  const workflow = await read(".github/workflows/deploy-homologation-v2.yml");
  assert.match(workflow, /npm run report:migration-integrity/);
  assert.match(workflow, /artifacts\/migration-integrity\.json/);
  assert.match(workflow, /artifacts\/migration-integrity\.md/);
  assert.doesNotMatch(workflow, /npm run audit:migrations/);
});

test("mantém artefatos locais fora do Git e documenta os conflitos atuais", async () => {
  const ignore = await read(".gitignore");
  const status = await read("docs/migration-integrity-status.md");
  assert.match(ignore, /artifacts\/migration-integrity\.json/);
  assert.match(ignore, /artifacts\/migration-integrity\.md/);
  assert.match(status, /20260727082000/);
  assert.match(status, /20260727180000/);
  assert.match(status, /20260727182000/);
  assert.match(status, /migration repair/);
});
