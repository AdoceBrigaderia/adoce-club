import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MIGRATION_NAME_PATTERN = /^(\d{14})_([a-z0-9][a-z0-9_]*)\.sql$/;

export async function inspectMigrationDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  const invalidFiles = [];
  const versions = new Map();

  for (const file of files) {
    const match = MIGRATION_NAME_PATTERN.exec(file);
    if (!match) {
      invalidFiles.push(file);
      continue;
    }
    const version = match[1];
    const grouped = versions.get(version) || [];
    grouped.push(file);
    versions.set(version, grouped);
  }

  const duplicateVersions = [...versions.entries()]
    .filter(([, grouped]) => grouped.length > 1)
    .map(([version, grouped]) => ({ version, files: grouped.sort() }))
    .sort((left, right) => left.version.localeCompare(right.version));

  return {
    schema_version: 1,
    migration_directory: path.normalize(directory),
    total_files: files.length,
    valid_files: files.length - invalidFiles.length,
    unique_versions: versions.size,
    invalid_files: invalidFiles,
    duplicate_versions: duplicateVersions,
    passed: invalidFiles.length === 0 && duplicateVersions.length === 0,
  };
}

export function renderMigrationIntegrityMarkdown(report) {
  const lines = [
    "# Integridade das migrations",
    "",
    `- Resultado: **${report.passed ? "aprovado" : "bloqueado"}**`,
    `- Arquivos SQL: ${report.total_files}`,
    `- Versões únicas: ${report.unique_versions}`,
    `- Nomes inválidos: ${report.invalid_files.length}`,
    `- Versões duplicadas: ${report.duplicate_versions.length}`,
    "",
  ];

  if (report.invalid_files.length) {
    lines.push("## Arquivos com nome inválido", "");
    for (const file of report.invalid_files) lines.push(`- \`${file}\``);
    lines.push("");
  }

  if (report.duplicate_versions.length) {
    lines.push("## Versões duplicadas", "");
    for (const duplicate of report.duplicate_versions) {
      lines.push(`### ${duplicate.version}`, "");
      for (const file of duplicate.files) lines.push(`- \`${file}\``);
      lines.push("");
    }
  }

  if (report.passed) {
    lines.push("Nenhum conflito de versão ou nome foi encontrado.", "");
  } else {
    lines.push(
      "A publicação deve permanecer bloqueada até que cada migration tenha um timestamp exclusivo e o histórico remoto seja reconciliado de forma controlada.",
      "",
    );
  }

  lines.push(
    "O relatório contém somente nomes de arquivos e contagens. O conteúdo SQL não é copiado para os artefatos.",
    "",
  );
  return lines.join("\n");
}

export async function writeMigrationIntegrityReport(report, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const jsonPath = path.join(outputDirectory, "migration-integrity.json");
  const markdownPath = path.join(outputDirectory, "migration-integrity.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMigrationIntegrityMarkdown(report), "utf8");
  return { jsonPath, markdownPath };
}

function parseArguments(argv) {
  const result = {
    directory: "supabase/migrations",
    outputDirectory: "artifacts",
    strict: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--strict") result.strict = true;
    else if (value === "--directory") result.directory = argv[++index];
    else if (value === "--output-dir") result.outputDirectory = argv[++index];
    else throw new Error(`Argumento não reconhecido: ${value}`);
  }
  if (!result.directory || !result.outputDirectory) {
    throw new Error("Diretório de migrations e diretório de saída são obrigatórios.");
  }
  return result;
}

export async function runMigrationIntegrityCli(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const report = await inspectMigrationDirectory(options.directory);
  const files = await writeMigrationIntegrityReport(report, options.outputDirectory);
  console.log(JSON.stringify({ ...report, artifacts: files }, null, 2));
  if (options.strict && !report.passed) process.exitCode = 1;
  return report;
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  runMigrationIntegrityCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
