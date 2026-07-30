import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { atomizeHomologationMigrationBundle } from './atomize-homologation-migration-bundle.mjs';
import { validateHomologationMigrationBundle } from './validate-homologation-migration-bundle.mjs';

const versions = Array.from({ length: 22 }, (_, index) => `20260728${String(index).padStart(6, '0')}`);

function sourceFixture() {
  const sections = ['-- Bundle legado sem transação externa.', '-- Produção proibida.', ''];
  for (const version of versions) {
    sections.push(
      `-- BEGIN ${version}_migration.sql SHA256 teste`,
      'select 1;',
      `insert into supabase_migrations.schema_migrations(version, statements, name, created_by) values ('${version}', array[]::text[], 'migration', 'teste');`,
      `-- END ${version}_migration.sql`,
      '',
    );
  }
  const bundle = `${sections.join('\n')}\n`;
  return {
    bundle,
    manifest: {
      schema_version: 1,
      project_id: 'vazozolhbehnriytzcdc',
      production_forbidden: true,
      migration_count: 22,
      bundle_sha256: crypto.createHash('sha256').update(bundle).digest('hex'),
    },
  };
}

test('envolve as 22 migrations em uma única transação com lock', () => {
  const atomic = atomizeHomologationMigrationBundle(sourceFixture());
  const report = validateHomologationMigrationBundle(atomic);
  assert.equal(report.atomic, true);
  assert.equal(atomic.manifest.atomic_transaction, true);
  assert.match(atomic.bundle, /^begin;$/m);
  assert.match(atomic.bundle, /^commit;$/m);
  assert.match(atomic.bundle, /pg_advisory_xact_lock/);
});

test('é idempotente quando o bundle já está atômico', () => {
  const first = atomizeHomologationMigrationBundle(sourceFixture());
  const second = atomizeHomologationMigrationBundle(first);
  assert.deepEqual(second, first);
});

test('rejeita bundle parcialmente transacional', () => {
  const fixture = sourceFixture();
  fixture.bundle = `begin;\n${fixture.bundle}`;
  assert.throws(
    () => atomizeHomologationMigrationBundle(fixture),
    /parcialmente transacional/,
  );
});
