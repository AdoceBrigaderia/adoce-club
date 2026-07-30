import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FILE_PATTERN = /^(\d{14})_([a-z0-9][a-z0-9_]*)\.sql$/;
const EXPECTED_PROJECT = "vazozolhbehnriytzcdc";
const EXPECTED_BRANCH = "reestruturacao/ux-crm-operacao-imagens-v1";

const duplicates = (values) => {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
};

export function inspectPendingMigrationPlan(plan, files, remoteNames = []) {
  const errors = [];
  if (plan?.schema_version !== 1) errors.push("schema_version inválido");
  if (plan?.environment !== "homologation") errors.push("ambiente inválido");
  if (plan?.project_id !== EXPECTED_PROJECT) errors.push("projeto de homologação inválido");
  if (plan?.branch !== EXPECTED_BRANCH) errors.push("branch inválida");
  if (plan?.production_forbidden !== true) errors.push("bloqueio de produção ausente");

  const lastVersion = String(plan?.remote_last_applied?.version || "");
  if (!/^\d{14}$/.test(lastVersion)) errors.push("última versão remota inválida");

  const pending = Array.isArray(plan?.pending_migrations) ? plan.pending_migrations : [];
  const normalized = pending.map((item) => ({
    version: String(item.version || ""),
    name: String(item.name || ""),
    stage: String(item.stage || ""),
    file: `${item.version}_${item.name}.sql`,
  }));
  if (!normalized.length) errors.push("lista pendente vazia");
  if (duplicates(normalized.map((item) => item.version)).length) errors.push("versões repetidas no plano");
  if (duplicates(normalized.map((item) => item.name)).length) errors.push("nomes repetidos no plano");

  const ordered = normalized.map((item) => item.version);
  if (JSON.stringify(ordered) !== JSON.stringify([...ordered].sort())) errors.push("ordem de versões inválida");
  for (const item of normalized) {
    if (!/^\d{14}$/.test(item.version) || !/^[a-z0-9][a-z0-9_]*$/.test(item.name)) errors.push(`entrada inválida: ${item.file}`);
    if (item.version <= lastVersion) errors.push(`entrada anterior ao histórico remoto: ${item.file}`);
    if (!item.stage) errors.push(`stage ausente: ${item.file}`);
  }

  const representedRemoteNames = new Set(remoteNames.map((name) => String(name)));
  const localPending = files
    .map((file) => {
      const match = FILE_PATTERN.exec(file);
      return match ? { file, version: match[1], name: match[2] } : null;
    })
    .filter((item) => item && item.version > lastVersion && !representedRemoteNames.has(item.name))
    .map((item) => item.file)
    .sort();
  const plannedFiles = normalized.map((item) => item.file).sort();
  const missing = plannedFiles.filter((file) => !localPending.includes(file));
  const unexpected = localPending.filter((file) => !plannedFiles.includes(file));
  if (missing.length) errors.push(`arquivos ausentes: ${missing.join(", ")}`);
  if (unexpected.length) errors.push(`arquivos fora do plano: ${unexpected.join(", ")}`);

  const repairs = Array.isArray(plan?.required_repairs) ? plan.required_repairs : [];
  if (repairs.length !== 3) errors.push("quantidade de repairs diferente de três");
  if (plan?.apply_policy?.partial_apply_forbidden !== true) errors.push("aplicação parcial não está bloqueada");

  const blockers = [];
  if (plan?.backup?.confirmed !== true) blockers.push("backup_nao_confirmado");
  if (repairs.some((repair) => repair.confirmed !== true)) blockers.push("repairs_pendentes");
  if (plan?.dry_run?.status !== "passed") blockers.push("dry_run_pendente");
  if (errors.length) blockers.push("plano_invalido");

  return {
    schema_version: 1,
    environment: plan?.environment || null,
    project_id: plan?.project_id || null,
    head_evaluated: plan?.head_evaluated || null,
    remote_last_applied: plan?.remote_last_applied || null,
    represented_remote_names_count: representedRemoteNames.size,
    pending_count: normalized.length,
    pending_migrations: normalized,
    missing_planned_files: missing,
    unexpected_pending_files: unexpected,
    structural_passed: errors.length === 0,
    ready_for_apply: errors.length === 0 && blockers.length === 0,
    apply_blockers: blockers,
    errors,
  };
}

export function renderPendingMigrationMarkdown(report) {
  return [
    "# Pré-flight das migrations de homologação",
    "",
    `- Plano estrutural: **${report.structural_passed ? "aprovado" : "reprovado"}**`,
    `- Pronto para aplicação: **${report.ready_for_apply ? "sim" : "não"}**`,
    `- Projeto: \`${report.project_id || "não informado"}\``,
    `- Nomes já representados no histórico remoto: **${report.represented_remote_names_count}**`,
    `- Migrations pendentes: **${report.pending_count}**`,
    "",
    "## Ordem obrigatória",
    "",
    ...report.pending_migrations.map((item) => `- \`${item.file}\` — ${item.stage}`),
    "",
    "## Bloqueios",
    "",
    ...(report.apply_blockers.length ? report.apply_blockers.map((item) => `- \`${item}\``) : ["- nenhum"]),
    "",
    "Este relatório não altera banco, histórico remoto ou dados.",
    "",
  ].join("\n");
}

export async function runPendingMigrationCli(argv = process.argv.slice(2)) {
  const strict = argv.includes("--strict");
  const requireReady = argv.includes("--require-ready");
  const planPath = "docs/evidence/homologation-pending-migrations-20260728.json";
  const remoteSnapshotPath = "docs/evidence/homologation-migrations-20260727.json";
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const remoteSnapshot = JSON.parse(await readFile(remoteSnapshotPath, "utf8"));
  const remoteNames = Array.isArray(remoteSnapshot.migrations)
    ? remoteSnapshot.migrations.map((migration) => migration.name)
    : [];
  const files = (await readdir("supabase/migrations")).filter((file) => file.endsWith(".sql"));
  const report = inspectPendingMigrationPlan(plan, files, remoteNames);
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/homologation-pending-migrations.json", `${JSON.stringify(report, null, 2)}\n`);
  await writeFile("artifacts/homologation-pending-migrations.md", renderPendingMigrationMarkdown(report));
  console.log(JSON.stringify(report, null, 2));
  if (strict && !report.structural_passed) process.exitCode = 1;
  if (requireReady && !report.ready_for_apply) process.exitCode = 2;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPendingMigrationCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
