import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(".github/workflows/homologation-storage-backup.yml", "utf8");
const script = await readFile("scripts/homologation-storage-backup.mjs", "utf8");

test("backup real é manual e contratos rodam no PR", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /github\.event_name == 'pull_request'/);
});

test("fixa o projeto de homologação e rejeita produção", () => {
  assert.match(workflow, /HOMOLOGATION_REF: vazozolhbehnriytzcdc/);
  assert.match(workflow, /HOMOLOGATION_URL: https:\/\/vazozolhbehnriytzcdc\.supabase\.co/);
  assert.match(workflow, /PRODUCTION_REF: uefwywizqhfvvijaopcn/);
  assert.match(workflow, /Referência produtiva proibida/);
  assert.match(script, /EXPECTED_REF = "vazozolhbehnriytzcdc"/);
  assert.doesNotMatch(workflow, /--prod\b/);
  assert.doesNotMatch(workflow, /db push/);
  assert.doesNotMatch(workflow, /migration repair/);
});

test("segredo permanece no cofre e não é impresso", () => {
  assert.match(workflow, /secrets\.SUPABASE_HOMOLOGATION_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(workflow, /echo\s+"?\$STORAGE_SECRET/);
  assert.doesNotMatch(workflow, /echo\s+"?\$SUPABASE_HOMOLOGATION_SERVICE_ROLE_KEY/);
  assert.match(script, /persistSession: false/);
  assert.match(script, /autoRefreshToken: false/);
});

test("preserva objetos, hashes e manifesto", () => {
  assert.match(script, /listBuckets\(\)/);
  assert.match(script, /\.download\(path\)/);
  assert.match(script, /storage-manifest\.json/);
  assert.match(script, /sha256/);
  assert.match(workflow, /Validar hashes dos objetos/);
  assert.match(workflow, /retention-days: 30/);
  assert.match(workflow, /Produção: \*\*não acessada e não alterada\*\*/);
});
