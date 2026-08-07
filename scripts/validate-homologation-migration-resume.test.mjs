import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  normalizeMigrationVersions,
  parseDryRunMigrationVersions,
  validateMigrationResume,
} from './validate-homologation-migration-resume.mjs';

const plan = JSON.parse(
  fs.readFileSync('docs/evidence/homologation-pending-migrations-20260728.superseded.json', 'utf8'),
);
const expected = plan.pending_migrations.map((migration) => migration.version);
const names = new Map(
  plan.pending_migrations.map((migration) => [migration.version, migration.name]),
);

function dryRunFor(versions, { duplicate = false } = {}) {
  const lines = versions.map((version) => `${version}_${names.get(version)}.sql`);
  return duplicate ? [...lines, ...lines].join('\n') : lines.join('\n');
}

test('normaliza versões com ordenação e remoção de duplicidades', () => {
  assert.deepEqual(
    normalizeMigrationVersions(['20260728225000', '20260728073000', '20260728225000']),
    ['20260728073000', '20260728225000'],
  );
  assert.throws(
    () => normalizeMigrationVersions(['2026-invalida']),
    /versões inválidas/,
  );
});

test('extrai migrations do dry-run sem contar linhas repetidas', () => {
  const selected = expected.slice(0, 3);
  assert.deepEqual(parseDryRunMigrationVersions(dryRunFor(selected, { duplicate: true })), selected);
});

test('aprova lote integral ainda não aplicado', () => {
  const report = validateMigrationResume({
    expectedVersions: expected,
    appliedVersions: [],
    dryRunOutput: dryRunFor(expected),
  });
  assert.equal(report.applied_count, 0);
  assert.equal(report.pending_count, 22);
  assert.equal(report.resumable, true);
});

test('aprova retomada exata após aplicação parcial e tolera repetição no log', () => {
  const applied = expected.slice(0, 7);
  const pending = expected.slice(7);
  const report = validateMigrationResume({
    expectedVersions: expected,
    appliedVersions: [...applied, applied[0]],
    dryRunOutput: dryRunFor(pending, { duplicate: true }),
  });
  assert.deepEqual(report.applied_versions, applied);
  assert.deepEqual(report.pending_versions, pending);
  assert.equal(report.applied_count + report.pending_count, 22);
});

test('rejeita migration remota fora do plano', () => {
  assert.throws(
    () => validateMigrationResume({
      expectedVersions: expected,
      appliedVersions: [...expected.slice(0, 2), '20260729999999'],
      dryRunOutput: dryRunFor(expected.slice(2)),
    }),
    /fora do plano/,
  );
});

test('rejeita dry-run incompleto ou com versão extra', () => {
  const applied = expected.slice(0, 4);
  const pending = expected.slice(4);
  assert.throws(
    () => validateMigrationResume({
      expectedVersions: expected,
      appliedVersions: applied,
      dryRunOutput: dryRunFor(pending.slice(1)),
    }),
    /Retomada divergente/,
  );
  assert.throws(
    () => validateMigrationResume({
      expectedVersions: expected,
      appliedVersions: applied,
      dryRunOutput: `${dryRunFor(pending)}\n20260729999999_extra.sql`,
    }),
    /extras no dry-run/,
  );
});
