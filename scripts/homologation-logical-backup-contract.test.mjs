import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/homologation-logical-backup.yml";
const workflow = await readFile(workflowPath, "utf8");

test("workflow é manual para o backup real e automático apenas para contratos", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /github\.event_name == 'pull_request'/);
});

test("bloqueia produção e exige commit e frase exatos", () => {
  assert.match(workflow, /EXPECTED_BRANCH: reestruturacao\/ux-crm-operacao-imagens-v1/);
  assert.match(workflow, /HOMOLOGATION_REF: vazozolhbehnriytzcdc/);
  assert.match(workflow, /PRODUCTION_REF: uefwywizqhfvvijaopcn/);
  assert.match(workflow, /GERAR BACKUP SOMENTE HOMOLOGACAO/);
  assert.match(workflow, /git rev-parse HEAD/);
  assert.match(workflow, /Referência produtiva proibida/);
  assert.doesNotMatch(workflow, /--prod\b/);
  assert.doesNotMatch(workflow, /migration repair/);
  assert.doesNotMatch(workflow, /db push/);
});

test("usa procedimento oficial e preserva todos os arquivos", () => {
  assert.match(workflow, /roles\.sql[\s\S]*--role-only/);
  assert.match(workflow, /schema\.sql/);
  assert.match(workflow, /data\.sql[\s\S]*--use-copy[\s\S]*--data-only/);
  assert.match(workflow, /history_schema\.sql[\s\S]*--schema supabase_migrations/);
  assert.match(workflow, /history_data\.sql[\s\S]*--schema supabase_migrations/);
  assert.match(workflow, /history\.csv/);
  assert.match(workflow, /manifest\.json/);
  assert.match(workflow, /manifest\.md/);
  assert.match(workflow, /sha256sum -c/);
  assert.match(workflow, /retention-days: 30/);
});

test("não imprime o segredo e registra que Storage é separado", () => {
  assert.match(workflow, /secrets\.SUPABASE_HOMOLOGATION_DB_URL/);
  assert.doesNotMatch(workflow, /echo\s+"?\$SUPABASE_HOMOLOGATION_DB_URL/);
  assert.match(workflow, /Storage: objetos binários não incluídos/);
  assert.match(workflow, /Produção: \*\*não acessada e não alterada\*\*/);
});
