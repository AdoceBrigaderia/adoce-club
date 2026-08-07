import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOMOLOGATION_MIGRATION_LOCK = 'adoce-homologation-migrations-20260728';

export function atomizeHomologationMigrationBundle({ bundle, manifest }) {
  const beginCount = bundle.match(/^begin;$/gmu)?.length ?? 0;
  const commitCount = bundle.match(/^commit;$/gmu)?.length ?? 0;
  if (beginCount > 0 || commitCount > 0) {
    if (beginCount === 1 && commitCount === 1 && manifest.atomic_transaction === true) {
      return { bundle, manifest };
    }
    throw new Error(`Bundle parcialmente transacional: begin=${beginCount}, commit=${commitCount}.`);
  }

  const firstMigration = bundle.indexOf('-- BEGIN ');
  if (firstMigration < 0) {
    if (manifest.migration_count === 0) {
      return { bundle, manifest: { ...manifest, atomic_transaction: true, advisory_lock: null } };
    }
    throw new Error('Bundle sem marcador da primeira migration.');
  }
  const preamble = bundle.slice(0, firstMigration).trimEnd();
  const migrations = bundle.slice(firstMigration).trim();
  const atomicBundle = [
    preamble,
    '',
    'begin;',
    `select pg_advisory_xact_lock(hashtextextended('${HOMOLOGATION_MIGRATION_LOCK}', 0));`,
    '',
    migrations,
    '',
    'commit;',
    '',
  ].join('\n');

  const atomicManifest = {
    ...manifest,
    atomic_transaction: true,
    advisory_lock: HOMOLOGATION_MIGRATION_LOCK,
    bundle_sha256: crypto.createHash('sha256').update(atomicBundle).digest('hex'),
  };
  return { bundle: atomicBundle, manifest: atomicManifest };
}

export function atomizeBundleFiles({ bundlePath, manifestPath }) {
  const bundle = fs.readFileSync(bundlePath, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const atomic = atomizeHomologationMigrationBundle({ bundle, manifest });
  fs.writeFileSync(bundlePath, atomic.bundle, { mode: 0o600 });
  fs.writeFileSync(manifestPath, `${JSON.stringify(atomic.manifest, null, 2)}\n`, { mode: 0o600 });
  return atomic;
}

function runCli() {
  const bundlePath = path.resolve(
    process.argv[2] ?? 'public/homologation-internal/migrations-2f2e6bd6b6154fc184622467a54e62ca.sql',
  );
  const manifestPath = path.resolve(process.argv[3] ?? `${bundlePath}.json`);
  atomizeBundleFiles({ bundlePath, manifestPath });
  process.stdout.write('Bundle da homologação protegido por transação atômica.\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) runCli();
