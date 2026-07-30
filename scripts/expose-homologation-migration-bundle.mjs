import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const projectId = 'vazozolhbehnriytzcdc';
const productionProjectId = 'uefwywizqhfvvijaopcn';
const outputName = 'migrations-2f2e6bd6b6154fc184622467a54e62ca.sql';
const planPath = path.resolve('docs/evidence/homologation-pending-migrations-20260728.json');
const outputDirectory = path.resolve('public/homologation-internal');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

if (plan.project_id !== projectId) throw new Error('Plano não pertence à homologação autorizada.');
if (plan.production_project_id !== productionProjectId || plan.production_forbidden !== true) {
  throw new Error('Bloqueio de produção inválido.');
}
if (!Array.isArray(plan.pending_migrations) || plan.pending_migrations.length !== 22) {
  throw new Error('O bundle exige exatamente 22 migrations.');
}

const sections = [
  '-- Bundle temporário e transacional das migrations de homologação.',
  `-- Projeto autorizado: ${projectId}`,
  '-- Produção proibida.',
  '',
];
const manifest = [];

for (const migration of plan.pending_migrations) {
  const fileName = `${migration.version}_${migration.name}.sql`;
  const filePath = path.resolve('supabase/migrations', fileName);
  let sql = fs.readFileSync(filePath, 'utf8').trim();
  if (!/^begin;\s*/i.test(sql) || !/\s*commit;$/i.test(sql)) {
    throw new Error(`Migration sem transação externa reconhecida: ${fileName}`);
  }
  sql = sql.replace(/^begin;\s*/i, '').replace(/\s*commit;$/i, '').trim();
  if (sql.includes(productionProjectId)) throw new Error(`Referência produtiva encontrada em ${fileName}`);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  manifest.push({ version: migration.version, name: migration.name, file: fileName, sha256 });
  sections.push(
    `-- BEGIN ${fileName} SHA256 ${sha256}`,
    sql,
    `insert into supabase_migrations.schema_migrations(version, statements, name, created_by) values ('${migration.version}', array[]::text[], '${migration.name.replaceAll("'", "''")}', 'authenticated-supabase-connector');`,
    `-- END ${fileName}`,
    '',
  );
}

const bundle = `${sections.join('\n')}\n`;
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, outputName), bundle, { mode: 0o600 });
fs.writeFileSync(
  path.join(outputDirectory, `${outputName}.json`),
  `${JSON.stringify({
    schema_version: 1,
    project_id: projectId,
    production_forbidden: true,
    migration_count: manifest.length,
    bundle_sha256: crypto.createHash('sha256').update(bundle).digest('hex'),
    migrations: manifest,
  }, null, 2)}\n`,
  { mode: 0o600 },
);
