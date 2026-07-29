import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const VERSION_PATTERN = /^\d{14}$/;

export function normalizeMigrationVersions(values, label = 'versions') {
  const normalized = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].sort();
  const invalid = normalized.filter((value) => !VERSION_PATTERN.test(value));
  if (invalid.length > 0) {
    throw new Error(`${label} contém versões inválidas: ${invalid.join(', ')}`);
  }
  return normalized;
}

export function parseDryRunMigrationVersions(output) {
  return normalizeMigrationVersions(
    [...String(output).matchAll(/(\d{14})_[^\s]+\.sql/g)].map((match) => match[1]),
    'dry-run',
  );
}

export function validateMigrationResume({ expectedVersions, appliedVersions, dryRunOutput }) {
  const expected = normalizeMigrationVersions(expectedVersions, 'plano');
  const applied = normalizeMigrationVersions(appliedVersions, 'histórico remoto');
  const pending = parseDryRunMigrationVersions(dryRunOutput);

  if (expected.length !== 22) {
    throw new Error(`O plano precisa conter exatamente 22 migrations; recebeu ${expected.length}.`);
  }

  const unexpectedApplied = applied.filter((version) => !expected.includes(version));
  if (unexpectedApplied.length > 0) {
    throw new Error(`Histórico remoto contém migrations fora do plano: ${unexpectedApplied.join(', ')}.`);
  }

  const expectedPending = expected.filter((version) => !applied.includes(version));
  if (JSON.stringify(pending) !== JSON.stringify(expectedPending)) {
    const missingFromDryRun = expectedPending.filter((version) => !pending.includes(version));
    const unexpectedInDryRun = pending.filter((version) => !expectedPending.includes(version));
    throw new Error(
      `Retomada divergente: ${applied.length} aplicadas, ${pending.length} pendentes, ` +
      `ausentes no dry-run [${missingFromDryRun.join(', ')}], extras no dry-run [${unexpectedInDryRun.join(', ')}].`,
    );
  }

  const resumed = normalizeMigrationVersions([...applied, ...pending], 'conjunto retomado');
  if (JSON.stringify(resumed) !== JSON.stringify(expected)) {
    throw new Error('O conjunto aplicado mais pendente não corresponde exatamente às 22 migrations aprovadas.');
  }

  return {
    schema_version: 1,
    expected_count: expected.length,
    applied_count: applied.length,
    pending_count: pending.length,
    expected_versions: expected,
    applied_versions: applied,
    pending_versions: pending,
    resumable: true,
  };
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Argumentos inválidos próximos de ${key ?? '<fim>'}.`);
    }
    values.set(key.slice(2), value);
  }
  return values;
}

function runCli() {
  const args = parseArguments(process.argv.slice(2));
  const planPath = args.get('plan');
  const appliedPath = args.get('applied');
  const dryRunPath = args.get('dry-run');
  const reportPath = args.get('report');
  if (!planPath || !appliedPath || !dryRunPath || !reportPath) {
    throw new Error('Informe --plan, --applied, --dry-run e --report.');
  }

  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  if (!Array.isArray(plan.pending_migrations)) {
    throw new Error('Plano sem pending_migrations.');
  }

  const report = validateMigrationResume({
    expectedVersions: plan.pending_migrations.map((migration) => migration.version),
    appliedVersions: fs.readFileSync(appliedPath, 'utf8').split(/\s+/),
    dryRunOutput: fs.readFileSync(dryRunPath, 'utf8'),
  });

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(
    `Retomada aprovada: ${report.applied_count} aplicadas + ${report.pending_count} pendentes = ${report.expected_count}.\n`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli();
}
