import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const EXPECTED_PROJECT = "vazozolhbehnriytzcdc";
const FORBIDDEN_PROJECT = "uefwywizqhfvvijaopcn";
const REQUIRED_FILES = [
  "roles.sql",
  "schema.sql",
  "data.sql",
  "history_schema.sql",
  "history_data.sql",
  "history.csv",
];

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) continue;
    values.set(argument.slice(2), argv[index + 1]);
    index += 1;
  }
  return {
    directory: values.get("directory"),
    project: values.get("project"),
    commit: values.get("commit"),
    createdAt: values.get("created-at") || new Date().toISOString(),
    label: values.get("label") || "backup-logico-homologacao",
  };
}

async function digestFile(path) {
  const contents = await readFile(path);
  return {
    bytes: contents.byteLength,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
}

export async function buildBackupManifest(options) {
  if (!options.directory) throw new Error("Diretório do backup não informado.");
  if (options.project !== EXPECTED_PROJECT) {
    throw new Error("O manifesto aceita exclusivamente o projeto de homologação.");
  }
  if (options.project === FORBIDDEN_PROJECT) {
    throw new Error("Projeto produtivo proibido.");
  }
  if (!/^[0-9a-f]{40}$/i.test(options.commit || "")) {
    throw new Error("SHA completo do commit é obrigatório.");
  }

  const directory = resolve(options.directory);
  const present = new Set(await readdir(directory));
  for (const file of REQUIRED_FILES) {
    if (!present.has(file)) throw new Error(`Arquivo obrigatório ausente: ${file}`);
    const details = await stat(join(directory, file));
    if (!details.isFile() || details.size === 0) {
      throw new Error(`Arquivo obrigatório vazio ou inválido: ${file}`);
    }
  }

  const files = [];
  for (const file of REQUIRED_FILES) {
    const integrity = await digestFile(join(directory, file));
    files.push({ name: basename(file), ...integrity });
  }

  return {
    schema_version: 1,
    environment: "homologation",
    project_ref: options.project,
    commit: options.commit,
    label: options.label,
    created_at: options.createdAt,
    database_backup: {
      format: "supabase-cli-logical-sql",
      files,
      integrity: "sha256",
      recoverable_with: "Supabase CLI e psql compatíveis",
    },
    storage_backup: {
      included: false,
      reason: "Objetos binários do Supabase Storage não fazem parte do dump SQL.",
      required_separately: true,
    },
    production: {
      project_ref: FORBIDDEN_PROJECT,
      accessed: false,
      altered: false,
    },
  };
}

export function manifestMarkdown(manifest) {
  const rows = manifest.database_backup.files
    .map((file) => `| ${file.name} | ${file.bytes} | \`${file.sha256}\` |`)
    .join("\n");
  return [
    "# Backup lógico da homologação",
    "",
    `- Projeto: \`${manifest.project_ref}\``,
    `- Commit: \`${manifest.commit}\``,
    `- Criado em: ${manifest.created_at}`,
    `- Identificador: \`${manifest.label}\``,
    "- Produção: não acessada e não alterada",
    "",
    "| Arquivo | Bytes | SHA-256 |",
    "|---|---:|---|",
    rows,
    "",
    "## Storage",
    "",
    "Os objetos binários do Supabase Storage não estão incluídos e exigem backup separado.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = await buildBackupManifest(options);
  const directory = resolve(options.directory);
  await writeFile(join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(directory, "manifest.md"), manifestMarkdown(manifest));
  process.stdout.write(`${JSON.stringify({ ok: true, files: manifest.database_backup.files.length })}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
