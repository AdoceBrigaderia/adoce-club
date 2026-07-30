import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const PRODUCTION_PROJECT_ID = 'uefwywizqhfvvijaopcn';
const HOMOLOGATION_PROJECT_ID = 'vazozolhbehnriytzcdc';

export function validateHomologationMigrationBundle({ bundle, manifest, expectedCount = 22 }) {
  const beginLines = [...String(bundle).matchAll(/^begin;$/gmu)].map((match) => match.index);
  const commitLines = [...String(bundle).matchAll(/^commit;$/gmu)].map((match) => match.index);
  const beginMarkers = [...String(bundle).matchAll(/^-- BEGIN /gmu)].map((match) => match.index);
  const endMarkers = [...String(bundle).matchAll(/^-- END /gmu)].map((match) => match.index);
  const historyWrites = [...String(bundle).matchAll(/^insert into supabase_migrations\.schema_migrations/gmu)];

  const errors = [];
  if (beginLines.length !== 1) errors.push(`begin externo esperado=1 encontrado=${beginLines.length}`);
  if (commitLines.length !== 1) errors.push(`commit externo esperado=1 encontrado=${commitLines.length}`);
  if (beginMarkers.length !== expectedCount) errors.push(`marcadores BEGIN esperados=${expectedCount} encontrados=${beginMarkers.length}`);
  if (endMarkers.length !== expectedCount) errors.push(`marcadores END esperados=${expectedCount} encontrados=${endMarkers.length}`);
  if (historyWrites.length !== expectedCount) errors.push(`registros de histórico esperados=${expectedCount} encontrados=${historyWrites.length}`);
  if (beginLines.length === 1 && beginMarkers.length > 0 && beginLines[0] > beginMarkers[0]) {
    errors.push('transação externa começa depois da primeira migration');
  }
  if (commitLines.length === 1 && endMarkers.length > 0 && commitLines[0] < endMarkers.at(-1)) {
    errors.push('transação externa termina antes da última migration');
  }
  if (String(bundle).includes(PRODUCTION_PROJECT_ID)) errors.push('referência produtiva encontrada no bundle');
  if (manifest?.project_id !== HOMOLOGATION_PROJECT_ID) errors.push('manifesto não pertence à homologação');
  if (manifest?.production_forbidden !== true) errors.push('manifesto sem bloqueio produtivo');
  if (manifest?.atomic_transaction !== true) errors.push('manifesto não declara transação atômica');
  if (manifest?.migration_count !== expectedCount) errors.push('quantidade de migrations divergente no manifesto');

  const bundleSha256 = crypto.createHash('sha256').update(String(bundle)).digest('hex');
  if (manifest?.bundle_sha256 !== bundleSha256) errors.push('SHA-256 do bundle divergente');

  const report = {
    schema_version: 1,
    project_id: HOMOLOGATION_PROJECT_ID,
    production_forbidden: true,
    expected_count: expectedCount,
    begin_count: beginLines.length,
    commit_count: commitLines.length,
    begin_marker_count: beginMarkers.length,
    end_marker_count: endMarkers.length,
    history_write_count: historyWrites.length,
    bundle_sha256: bundleSha256,
    atomic: errors.length === 0,
    errors,
  };

  if (errors.length > 0) {
    const error = new Error(`Bundle de homologação não é atômico: ${errors.join('; ')}.`);
    error.report = report;
    throw error;
  }
  return report;
}

function parseArguments(argv) {
  const result = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error('Argumentos inválidos.');
    result.set(key.slice(2), value);
  }
  return result;
}

function runCli() {
  const args = parseArguments(process.argv.slice(2));
  const bundlePath = args.get('bundle');
  const manifestPath = args.get('manifest');
  const reportPath = args.get('report');
  if (!bundlePath || !manifestPath || !reportPath) {
    throw new Error('Informe --bundle, --manifest e --report.');
  }
  const bundle = fs.readFileSync(bundlePath, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  try {
    const report = validateHomologationMigrationBundle({ bundle, manifest });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write('Bundle atômico da homologação aprovado.\n');
  } catch (error) {
    if (error.report) fs.writeFileSync(reportPath, `${JSON.stringify(error.report, null, 2)}\n`);
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) runCli();
