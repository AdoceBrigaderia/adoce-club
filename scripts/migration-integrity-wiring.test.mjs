import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("liga integridade e reconciliação aos comandos e bloqueia produção", async () => {
  const packageSource = JSON.parse(await read("package.json"));
  assert.equal(
    packageSource.scripts["test:migration-integrity"],
    "node --test scripts/migration-integrity-report.test.mjs scripts/migration-integrity-wiring.test.mjs",
  );
  assert.equal(
    packageSource.scripts["test:migration-reconciliation"],
    "node --test scripts/migration-reconciliation-report.test.mjs",
  );
  assert.equal(
    packageSource.scripts["report:migration-integrity"],
    "node scripts/migration-integrity-report.mjs",
  );
  assert.equal(
    packageSource.scripts["report:migration-reconciliation"],
    "node scripts/migration-reconciliation-report.mjs --strict",
  );
  assert.equal(
    packageSource.scripts["audit:migrations"],
    "node scripts/migration-integrity-report.mjs --strict",
  );
  assert.equal(
    packageSource.scripts["audit:migration-reconciliation"],
    "node scripts/migration-reconciliation-report.mjs --strict",
  );
  assert.match(packageSource.scripts.verify, /test:migration-reconciliation/);
  assert.match(packageSource.scripts["release:preview"], /report:migration-reconciliation/);
  assert.match(packageSource.scripts["release:prod"], /audit:migrations/);
  assert.match(packageSource.scripts["release:prod"], /audit:migration-reconciliation/);
});

test("preserva os diagnósticos redigidos no workflow de homologação", async () => {
  const workflow = await read(".github/workflows/deploy-homologation-v2.yml");
  assert.match(workflow, /npm run report:migration-integrity/);
  assert.match(workflow, /npm run report:migration-reconciliation/);
  assert.match(workflow, /artifacts\/migration-integrity\.json/);
  assert.match(workflow, /artifacts\/migration-integrity\.md/);
  assert.match(workflow, /artifacts\/migration-reconciliation\.json/);
  assert.match(workflow, /artifacts\/migration-reconciliation\.md/);
  assert.doesNotMatch(workflow, /npm run audit:migrations/);
  assert.doesNotMatch(workflow, /npm run audit:migration-reconciliation/);
});

test("mantém artefatos fora do Git e documenta o estado local e remoto", async () => {
  const ignore = await read(".gitignore");
  const status = await read("docs/migration-integrity-status.md");
  const snapshot = JSON.parse(
    await read("docs/evidence/homologation-migrations-20260807.json"),
  );

  assert.match(ignore, /artifacts\/migration-integrity\.json/);
  assert.match(ignore, /artifacts\/migration-integrity\.md/);
  assert.match(ignore, /artifacts\/migration-reconciliation\.json/);
  assert.match(ignore, /artifacts\/migration-reconciliation\.md/);
  assert.match(status, /159 migrations/);
  assert.match(status, /08\/08\/2026/);
  assert.equal(snapshot.environment, "homologation");
  assert.equal(snapshot.project_id, "vazozolhbehnriytzcdc");
  assert.equal(snapshot.migrations.length, 159);
});
