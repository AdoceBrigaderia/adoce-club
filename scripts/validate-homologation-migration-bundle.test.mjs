import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { validateHomologationMigrationBundle } from './validate-homologation-migration-bundle.mjs';

const versions = Array.from({ length: 22 }, (_, index) => `20260728${String(index).padStart(6, '0')}`);

function buildFixture({ atomic = true, productionReference = false } = {}) {
  const sections = ['-- Bundle de teste.', '-- Produção proibida.', ''];
  if (atomic) sections.push('begin;', '');
  for (const version of versions) {
    const name = `migration_${version}`;
    sections.push(
      `-- BEGIN ${version}_${name}.sql SHA256 teste`,
      'select 1;',
      `insert into supabase_migrations.schema_migrations(version, statements, name, created_by) values ('${version}', array[]::text[], '${name}', 'teste');`,
      `-- END ${version}_${name}.sql`,
      '',
    );
  }
  if (productionReference) sections.push('-- uefwywizqhfvvijaopcn');
  if (atomic) sections.push('commit;');
  const bundle = `${sections.join('\n')}\n`;
  return {
    bundle,
    manifest: {
      project_id: 'vazozolhbehnriytzcdc',
      production_forbidden: true,
      atomic_transaction: atomic,
      migration_count: 22,
      bundle_sha256: crypto.createHash('sha256').update(bundle).digest('hex'),
    },
  };
}

test('aprova bundle com uma única transação envolvendo as 22 migrations', () => {
  const fixture = buildFixture();
  const report = validateHomologationMigrationBundle(fixture);
  assert.equal(report.atomic, true);
  assert.equal(report.begin_count, 1);
  assert.equal(report.commit_count, 1);
  assert.equal(report.history_write_count, 22);
});

test('rejeita bundle sem transação externa mesmo com 22 migrations', () => {
  const fixture = buildFixture({ atomic: false });
  assert.throws(
    () => validateHomologationMigrationBundle(fixture),
    /begin externo esperado=1|transação atômica/,
  );
});

test('rejeita referência produtiva e manifesto adulterado', () => {
  const fixture = buildFixture({ productionReference: true });
  fixture.manifest.bundle_sha256 = '0'.repeat(64);
  assert.throws(
    () => validateHomologationMigrationBundle(fixture),
    /referência produtiva|SHA-256/,
  );
});

test('rejeita commit antes do término do lote', () => {
  const fixture = buildFixture();
  fixture.bundle = fixture.bundle.replace('-- END 20260728000021', 'commit;\n-- END 20260728000021').replace(/\ncommit;\n$/, '\n');
  fixture.manifest.bundle_sha256 = crypto.createHash('sha256').update(fixture.bundle).digest('hex');
  assert.throws(
    () => validateHomologationMigrationBundle(fixture),
    /termina antes da última migration/,
  );
});
