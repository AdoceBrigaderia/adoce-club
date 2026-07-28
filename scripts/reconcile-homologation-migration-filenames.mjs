import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const strict = args.has('--strict');
const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const snapshotPath = path.join(root, 'docs', 'evidence', 'homologation-migrations-20260727.json');
const repairPlanPath = path.join(root, 'docs', 'evidence', 'homologation-migration-repair-plan-20260727.json');
const reportPath = path.join(root, 'docs', 'evidence', 'homologation-migration-filename-reconciliation-20260728.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseMigrationFilename(file) {
  const match = /^(\d{14})_(.+)\.sql$/.exec(file);
  return match ? { version: match[1], name: match[2] } : null;
}

const snapshot = readJson(snapshotPath);
const repairPlan = readJson(repairPlanPath);
const preferredVersion = new Map();
const versionsByName = new Map();

for (const migration of snapshot.migrations ?? []) {
  const versions = versionsByName.get(migration.name) ?? [];
  versions.push(migration.version);
  versionsByName.set(migration.name, versions);
}

for (const decision of repairPlan.decisions ?? []) {
  preferredVersion.set(decision.name, decision.keep_version);
}

for (const [name, versions] of versionsByName) {
  if (versions.length === 1) preferredVersion.set(name, versions[0]);
  if (versions.length > 1 && !preferredVersion.has(name)) {
    throw new Error(`Migration remota ambígua sem decisão explícita: ${name}`);
  }
}

const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
const actions = [];
const unchanged = [];
const ignored = [];
const errors = [];

for (const file of files) {
  const parsed = parseMigrationFilename(file);
  if (!parsed) {
    ignored.push({ file, reason: 'nome_fora_do_padrao' });
    continue;
  }

  const targetVersion = preferredVersion.get(parsed.name);
  if (!targetVersion) {
    ignored.push({ file, reason: 'migration_nova_ou_fora_do_snapshot' });
    continue;
  }

  if (parsed.version === targetVersion) {
    unchanged.push(file);
    continue;
  }

  const targetFile = `${targetVersion}_${parsed.name}.sql`;
  const sourcePath = path.join(migrationsDir, file);
  const targetPath = path.join(migrationsDir, targetFile);

  if (fs.existsSync(targetPath)) {
    const source = fs.readFileSync(sourcePath);
    const target = fs.readFileSync(targetPath);
    if (!source.equals(target)) {
      errors.push({ file, targetFile, reason: 'destino_existente_com_conteudo_diferente' });
      continue;
    }
    actions.push({ type: 'remove_duplicate_file', source: file, target: targetFile });
    continue;
  }

  actions.push({ type: 'rename', source: file, target: targetFile });
}

if (strict && errors.length > 0) {
  throw new Error(`Reconciliação bloqueada: ${JSON.stringify(errors)}`);
}

if (apply) {
  for (const action of actions) {
    const sourcePath = path.join(migrationsDir, action.source);
    const targetPath = path.join(migrationsDir, action.target);
    if (action.type === 'rename') fs.renameSync(sourcePath, targetPath);
    if (action.type === 'remove_duplicate_file') fs.unlinkSync(sourcePath);
  }
}

const report = {
  schema_version: 1,
  environment: 'homologation',
  project_id: snapshot.project_id,
  production_forbidden: true,
  generated_at: new Date().toISOString(),
  mode: apply ? 'apply' : 'dry-run',
  snapshot_path: path.relative(root, snapshotPath),
  repair_plan_path: path.relative(root, repairPlanPath),
  migration_files_scanned: files.length,
  rename_count: actions.filter((item) => item.type === 'rename').length,
  duplicate_file_removal_count: actions.filter((item) => item.type === 'remove_duplicate_file').length,
  unchanged_count: unchanged.length,
  ignored_count: ignored.length,
  errors,
  actions,
  ignored,
  passed: errors.length === 0,
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (strict && !report.passed) process.exit(1);
