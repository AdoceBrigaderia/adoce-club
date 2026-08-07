import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MIGRATION_FILE_PATTERN = /^(\d{14})_([a-z0-9][a-z0-9_]*)\.sql$/;
const VERSION_PATTERN = /^\d{14}$/;
const NAME_PATTERN = /^[a-z0-9][a-z0-9_]*$/;

function groupedDuplicates(items, keySelector, valueSelector) {
  const groups = new Map();
  for (const item of items) {
    const key = keySelector(item);
    const values = groups.get(key) || [];
    values.push(valueSelector(item));
    groups.set(key, values);
  }
  return [...groups.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([key, values]) => ({ key, values: values.sort() }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export async function readLocalMigrationInventory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  const valid = [];
  const invalid = [];
  for (const file of files) {
    const match = MIGRATION_FILE_PATTERN.exec(file);
    if (!match) {
      invalid.push(file);
      continue;
    }
    valid.push({ file, version: match[1], name: match[2] });
  }

  return { files, valid, invalid };
}

export async function loadRemoteMigrationSnapshot(snapshotPath) {
  const parsed = JSON.parse(await readFile(snapshotPath, "utf8"));
  if (!parsed || !Array.isArray(parsed.migrations)) {
    throw new Error("Snapshot remoto inválido: migrations deve ser uma lista.");
  }
  return parsed;
}

export function scopeLocalMigrationInventory(localInventory, snapshot) {
  const range = snapshot.local_version_range;
  if (!range) return localInventory;
  const minimum = String(range.minimum || "");
  const maximum = String(range.maximum || "");
  if (!VERSION_PATTERN.test(minimum) || !VERSION_PATTERN.test(maximum)) {
    throw new Error(
      "Snapshot remoto inválido: local_version_range deve conter versões de 14 dígitos.",
    );
  }
  if (minimum > maximum) {
    throw new Error(
      "Snapshot remoto inválido: o início do recorte local é posterior ao fim.",
    );
  }
  const valid = localInventory.valid.filter(
    (migration) =>
      migration.version >= minimum && migration.version <= maximum,
  );
  const invalid = localInventory.invalid;
  return {
    files: [...valid.map((migration) => migration.file), ...invalid].sort(),
    valid,
    invalid,
  };
}

export function inspectMigrationReconciliation(localInventory, snapshot) {
  const remote = snapshot.migrations.map((migration, index) => ({
    version: String(migration.version || ""),
    name: String(migration.name || ""),
    index,
  }));
  const invalidRemote = remote
    .filter(
      (migration) =>
        !VERSION_PATTERN.test(migration.version) ||
        !NAME_PATTERN.test(migration.name),
    )
    .map(({ version, name, index }) => ({ version, name, index }));

  const localDuplicateVersions = groupedDuplicates(
    localInventory.valid,
    (item) => item.version,
    (item) => item.file,
  ).map(({ key, values }) => ({ version: key, files: values }));

  const localDuplicateNames = groupedDuplicates(
    localInventory.valid,
    (item) => item.name,
    (item) => item.file,
  ).map(({ key, values }) => ({ name: key, files: values }));

  const remoteDuplicateNames = groupedDuplicates(
    remote,
    (item) => item.name,
    (item) => item.version,
  ).map(({ key, values }) => ({ name: key, versions: values }));

  const remoteByName = new Map();
  for (const migration of remote) {
    const entries = remoteByName.get(migration.name) || [];
    entries.push(migration);
    remoteByName.set(migration.name, entries);
  }

  const localNames = new Set(localInventory.valid.map((item) => item.name));
  const aligned = [];
  const versionDrift = [];
  const missingRemote = [];
  const ambiguousRemote = [];

  for (const migration of localInventory.valid) {
    const candidates = remoteByName.get(migration.name) || [];
    if (candidates.length === 0) {
      missingRemote.push({
        file: migration.file,
        local_version: migration.version,
        name: migration.name,
      });
      continue;
    }
    const exactVersion = candidates.find((item) => item.version === migration.version);
    if (exactVersion) {
      aligned.push({
        file: migration.file,
        name: migration.name,
        local_version: migration.version,
        remote_version: exactVersion.version,
        suggested_filename: `${exactVersion.version}_${migration.name}.sql`,
      });
      continue;
    }
    if (candidates.length > 1) {
      ambiguousRemote.push({
        file: migration.file,
        local_version: migration.version,
        name: migration.name,
        remote_versions: candidates.map((item) => item.version).sort(),
      });
      continue;
    }

    const remoteMigration = candidates[0];
    const comparison = {
      file: migration.file,
      name: migration.name,
      local_version: migration.version,
      remote_version: remoteMigration.version,
      suggested_filename: `${remoteMigration.version}_${migration.name}.sql`,
    };
    versionDrift.push(comparison);
  }

  const remoteOnly = [...remoteByName.entries()]
    .filter(([name]) => !localNames.has(name))
    .map(([name, entries]) => ({
      name,
      remote_versions: entries.map((item) => item.version).sort(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const targetCollisions = groupedDuplicates(
    versionDrift,
    (item) => item.suggested_filename,
    (item) => item.file,
  ).map(({ key, values }) => ({ target: key, sources: values }));

  const passed =
    localInventory.invalid.length === 0 &&
    invalidRemote.length === 0 &&
    localDuplicateVersions.length === 0 &&
    missingRemote.length === 0 &&
    ambiguousRemote.length === 0 &&
    remoteOnly.length === 0 &&
    versionDrift.length === 0 &&
    targetCollisions.length === 0;

  const safeToApplyRenamePlan =
    localInventory.invalid.length === 0 &&
    invalidRemote.length === 0 &&
    missingRemote.length === 0 &&
    ambiguousRemote.length === 0 &&
    remoteOnly.length === 0 &&
    targetCollisions.length === 0;

  return {
    schema_version: 1,
    environment: snapshot.environment || "unknown",
    project_id: snapshot.project_id || null,
    snapshot_captured_at: snapshot.captured_at || null,
    local_version_range: snapshot.local_version_range || null,
    local_total: localInventory.files.length,
    remote_total: remote.length,
    aligned_count: aligned.length,
    version_drift_count: versionDrift.length,
    passed,
    safe_to_apply_rename_plan: safeToApplyRenamePlan,
    invalid_local_files: localInventory.invalid,
    invalid_remote_entries: invalidRemote,
    local_duplicate_versions: localDuplicateVersions,
    local_duplicate_names: localDuplicateNames,
    remote_duplicate_names: remoteDuplicateNames,
    missing_remote: missingRemote,
    ambiguous_remote: ambiguousRemote,
    remote_only: remoteOnly,
    target_collisions: targetCollisions,
    aligned,
    rename_candidates: versionDrift,
  };
}

export function renderMigrationReconciliationMarkdown(report) {
  const lines = [
    "# Reconciliação das migrations de homologação",
    "",
    `- Resultado: **${report.passed ? "alinhado" : "bloqueado"}**`,
    `- Ambiente: \`${report.environment}\``,
    `- Projeto: \`${report.project_id || "não informado"}\``,
    `- Migrations locais: ${report.local_total}`,
    `- Registros remotos no recorte: ${report.remote_total}`,
    `- Versões já alinhadas: ${report.aligned_count}`,
    `- Versões com drift: ${report.version_drift_count}`,
    `- Plano de renomeação seguro para aplicação automática: **${report.safe_to_apply_rename_plan ? "sim" : "não"}**`,
    "",
  ];

  if (report.local_duplicate_versions.length) {
    lines.push("## Versões locais duplicadas", "");
    for (const item of report.local_duplicate_versions) {
      lines.push(`### ${item.version}`, "");
      for (const file of item.files) lines.push(`- \`${file}\``);
      lines.push("");
    }
  }

  if (report.remote_duplicate_names.length) {
    lines.push("## Nomes repetidos no histórico remoto", "");
    for (const item of report.remote_duplicate_names) {
      lines.push(`- \`${item.name}\`: ${item.versions.map((version) => `\`${version}\``).join(", ")}`);
    }
    lines.push(
      "",
      "Esses registros exigem decisão explícita de `migration repair` na homologação antes de qualquer renomeação em lote.",
      "",
    );
  }

  if (report.ambiguous_remote.length) {
    lines.push("## Migrations locais com correspondência remota ambígua", "");
    for (const item of report.ambiguous_remote) {
      lines.push(
        `- \`${item.file}\` → ${item.remote_versions.map((version) => `\`${version}\``).join(", ")}`,
      );
    }
    lines.push("");
  }

  if (report.rename_candidates.length) {
    lines.push("## Plano de renomeação por nome canônico", "");
    for (const item of report.rename_candidates) {
      lines.push(`- \`${item.file}\` → \`${item.suggested_filename}\``);
    }
    lines.push("");
  }

  if (report.missing_remote.length) {
    lines.push("## Migrations locais ausentes no snapshot remoto", "");
    for (const item of report.missing_remote) lines.push(`- \`${item.file}\``);
    lines.push("");
  }

  if (report.remote_only.length) {
    lines.push("## Registros remotos sem arquivo local no recorte", "");
    for (const item of report.remote_only) {
      lines.push(
        `- \`${item.name}\`: ${item.remote_versions.map((version) => `\`${version}\``).join(", ")}`,
      );
    }
    lines.push("");
  }

  if (report.passed) {
    lines.push("O histórico local está alinhado ao snapshot remoto informado.", "");
  } else {
    lines.push(
      "Nenhum arquivo foi renomeado e nenhum histórico remoto foi modificado por este relatório.",
      "A publicação deve permanecer bloqueada até a resolução das ambiguidades e a validação por dry-run.",
      "",
    );
  }

  lines.push(
    "O artefato contém somente nomes, versões e contagens. Nenhum conteúdo SQL é copiado.",
    "",
  );
  return lines.join("\n");
}

export async function writeMigrationReconciliationReport(report, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const jsonPath = path.join(outputDirectory, "migration-reconciliation.json");
  const markdownPath = path.join(outputDirectory, "migration-reconciliation.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMigrationReconciliationMarkdown(report), "utf8");
  return { jsonPath, markdownPath };
}

function parseArguments(argv) {
  const options = {
    directory: "supabase/migrations",
    snapshot: "docs/evidence/homologation-migrations-20260807.json",
    outputDirectory: "artifacts",
    strict: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--strict") options.strict = true;
    else if (value === "--directory") options.directory = argv[++index];
    else if (value === "--snapshot") options.snapshot = argv[++index];
    else if (value === "--output-dir") options.outputDirectory = argv[++index];
    else throw new Error(`Argumento não reconhecido: ${value}`);
  }
  if (!options.directory || !options.snapshot || !options.outputDirectory) {
    throw new Error("Diretório, snapshot e saída são obrigatórios.");
  }
  return options;
}

export async function runMigrationReconciliationCli(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const localInventory = await readLocalMigrationInventory(options.directory);
  const snapshot = await loadRemoteMigrationSnapshot(options.snapshot);
  const scopedLocalInventory = scopeLocalMigrationInventory(
    localInventory,
    snapshot,
  );
  const report = inspectMigrationReconciliation(scopedLocalInventory, snapshot);
  const artifacts = await writeMigrationReconciliationReport(
    report,
    options.outputDirectory,
  );
  console.log(JSON.stringify({ ...report, artifacts }, null, 2));
  if (options.strict && !report.passed) process.exitCode = 1;
  return report;
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  runMigrationReconciliationCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
