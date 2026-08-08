import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('scripts/reconcile-homologation-migration-filenames.mjs');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adoce-migration-reconcile-'));
  fs.mkdirSync(path.join(root, 'supabase', 'migrations'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'evidence'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs', 'evidence', 'homologation-migrations-20260807.json'),
    JSON.stringify({
      project_id: 'vazozolhbehnriytzcdc',
      migrations: [
        { version: '20260726005258', name: 'site_visual_asset_versions' },
        { version: '20260727035059', name: 'backend_only_tables_explicit_deny' },
        { version: '20260727035116', name: 'backend_only_tables_explicit_deny' },
      ],
    }),
  );
  fs.writeFileSync(
    path.join(root, 'docs', 'evidence', 'homologation-migration-repair-plan-20260727.json'),
    JSON.stringify({ decisions: [{ name: 'backend_only_tables_explicit_deny', keep_version: '20260727035116' }] }),
  );
  fs.writeFileSync(path.join(root, 'supabase', 'migrations', '20260726005500_site_visual_asset_versions.sql'), 'select 1;\n');
  fs.writeFileSync(path.join(root, 'supabase', 'migrations', '20260727093000_backend_only_tables_explicit_deny.sql'), 'select 2;\n');
  fs.writeFileSync(path.join(root, 'supabase', 'migrations', '20260728100000_new_feature.sql'), 'select 3;\n');
  return root;
}

function run(root, ...args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
}

test('dry-run descreve renomes sem alterar arquivos', () => {
  const root = fixture();
  const result = run(root, '--strict');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(root, 'supabase', 'migrations', '20260726005500_site_visual_asset_versions.sql')), true);
  const report = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'evidence', 'homologation-migration-filename-reconciliation-20260728.json'), 'utf8'));
  assert.equal(report.rename_count, 2);
  assert.equal(report.passed, true);
});

test('apply alinha versões remotas e preserva migrations novas', () => {
  const root = fixture();
  const result = run(root, '--strict', '--apply');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(root, 'supabase', 'migrations', '20260726005258_site_visual_asset_versions.sql')), true);
  assert.equal(fs.existsSync(path.join(root, 'supabase', 'migrations', '20260727035116_backend_only_tables_explicit_deny.sql')), true);
  assert.equal(fs.existsSync(path.join(root, 'supabase', 'migrations', '20260728100000_new_feature.sql')), true);
});
