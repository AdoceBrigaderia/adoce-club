import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflowPath = '.github/workflows/homologation-apply-pending-migrations.yml';
const liveAuditPath = 'supabase/tests/homologation_post_migration_live.sql';
const planPath = 'docs/evidence/homologation-pending-migrations-20260728.json';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const liveAudit = fs.readFileSync(liveAuditPath, 'utf8');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

test('aplicação de migrations é manual, isolada e exige commit exato', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+push:/);
  assert.doesNotMatch(workflow, /\n\s+pull_request:/);
  assert.match(workflow, /environment: homologation/);
  assert.match(workflow, /EXPECTED_BRANCH: reestruturacao\/ux-crm-operacao-imagens-v1/);
  assert.match(workflow, /HOMOLOGATION_REF: vazozolhbehnriytzcdc/);
  assert.match(workflow, /PRODUCTION_REF: uefwywizqhfvvijaopcn/);
  assert.match(workflow, /git rev-parse HEAD/);
  assert.match(workflow, /APLICAR 17 MIGRATIONS SOMENTE HOMOLOGACAO/);
  assert.match(workflow, /BACKUP CONFIRMADO/);
});

test('workflow executa dry-run antes da aplicação e não permite conjunto parcial', () => {
  const dryRunPosition = workflow.indexOf('--dry-run');
  const applyPosition = workflow.indexOf('Aplicar exatamente o conjunto aprovado');
  assert.ok(dryRunPosition > 0, 'dry-run precisa existir');
  assert.ok(applyPosition > dryRunPosition, 'aplicação precisa ocorrer depois do dry-run');
  assert.match(workflow, /pending_count !== 17/);
  assert.match(workflow, /--include-all/);
  assert.match(workflow, /expected-versions\.txt/);
  assert.match(workflow, /diff -u/);
  assert.equal(plan.pending_migrations.length, 17);
});

test('segredo do banco fica restrito ao environment e produção é rejeitada', () => {
  assert.match(workflow, /secrets\.SUPABASE_HOMOLOGATION_DB_URL/);
  assert.doesNotMatch(workflow, /SUPABASE_HOMOLOGATION_DB_URL:\s*(postgres|postgresql):\/\//);
  assert.match(workflow, /Referência produtiva rejeitada/);
  assert.match(workflow, /! grep -R \"\$PRODUCTION_REF\"/);
  assert.match(workflow, /! grep -R \"postgresql:\/\/\\|postgres:\/\/\"/);
  assert.doesNotMatch(workflow, /--prod\b/);
});

test('auditoria viva cobre histórico, RLS e ausência de acesso direto', () => {
  assert.match(workflow, /homologation_post_migration_live\.sql/);
  assert.match(liveAudit, /supabase_migrations\.schema_migrations/);
  assert.match(liveAudit, /applied_count <> cardinality\(expected_versions\)/);
  assert.match(liveAudit, /relation\.relrowsecurity/);
  assert.match(liveAudit, /has_table_privilege\(role_name/);
  assert.match(liveAudit, /private\.canonicalize_cake_builder_selection\(uuid,jsonb\)/);
  assert.match(liveAudit, /rollback;/);
});
