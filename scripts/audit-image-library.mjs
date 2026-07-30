import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  auditExitCode,
  buildAuditReport,
  extractCatalogKeys,
  extractImageReferences,
} from "./image-library-audit-core.mjs";

const ROOT = process.cwd();
const STRICT = process.argv.includes("--strict");
const JSON_ONLY = process.argv.includes("--json-only");
const IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".ico", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const TEXT_EXTENSIONS = new Set([".cjs", ".css", ".html", ".js", ".jsx", ".json", ".mjs", ".sql", ".ts", ".tsx", ".webmanifest"]);
const SOURCE_ROOTS = ["src", "netlify/functions", "public"];
const ROOT_TEXT_FILES = ["index.html", "netlify.toml"];
const IGNORED_DIRECTORIES = new Set([".git", ".netlify", "artifacts", "dist", "node_modules"]);
const IGNORED_FILE_PATTERN = /(?:^|\/)(?:coverage|docs-generated)(?:\/|$)|\.(?:spec|test)\.[cm]?[jt]sx?$/i;

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(relativeRoot, predicate) {
  const absoluteRoot = path.join(ROOT, relativeRoot);
  if (!(await exists(absoluteRoot))) return [];
  const output = [];

  async function visit(absoluteDirectory) {
    const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".well-known") continue;
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
      const absolutePath = path.join(absoluteDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      const relativePath = toPosix(path.relative(ROOT, absolutePath));
      if (predicate(relativePath)) output.push(relativePath);
    }
  }

  await visit(absoluteRoot);
  return output.sort();
}

async function collectTextFiles() {
  const files = new Set();
  for (const root of SOURCE_ROOTS) {
    const found = await walk(root, (file) => {
      if (IGNORED_FILE_PATTERN.test(file)) return false;
      return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
    });
    found.forEach((file) => files.add(file));
  }
  for (const file of ROOT_TEXT_FILES) {
    if (await exists(path.join(ROOT, file))) files.add(file);
  }
  return [...files].sort();
}

async function collectPublicImages() {
  const images = await walk("public", (file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  return new Set(images.map((file) => `/${file.slice("public/".length)}`));
}

async function collectUsages(textFiles) {
  const usages = new Map();
  for (const file of textFiles) {
    const content = await fs.readFile(path.join(ROOT, file), "utf8");
    for (const reference of extractImageReferences(content, file)) {
      const files = usages.get(reference) || new Set();
      files.add(file);
      usages.set(reference, files);
    }
  }
  return usages;
}

function markdownList(items, fallback) {
  if (!items.length) return fallback;
  return items.map((item) => `- \`${item}\``).join("\n");
}

function renderMarkdown(report) {
  return `# Auditoria da Biblioteca Central de Imagens\n\n` +
    `Gerado em: ${report.generatedAt}\n\n` +
    `## Resumo\n\n` +
    `| Verificação | Quantidade |\n|---|---:|\n` +
    `| Referências locais encontradas | ${report.totals.references} |\n` +
    `| Referências cadastradas na Central | ${report.totals.registered} |\n` +
    `| Referências ainda não cadastradas | ${report.totals.unregistered} |\n` +
    `| Referências com arquivo ausente | ${report.totals.missing} |\n` +
    `| Itens do catálogo com arquivo ausente | ${report.totals.catalogMissing} |\n` +
    `| Arquivos de imagem existentes em public | ${report.totals.publicFiles} |\n` +
    `| Arquivos sem uso nem cadastro identificado | ${report.totals.orphaned} |\n\n` +
    `## Imagens usadas e ainda não cadastradas\n\n${markdownList(report.unregistered, "Nenhuma.")}\n\n` +
    `## Referências quebradas\n\n${markdownList(report.missing, "Nenhuma.")}\n\n` +
    `## Itens cadastrados sem arquivo correspondente\n\n${markdownList(report.catalogMissing, "Nenhum.")}\n\n` +
    `## Arquivos potencialmente órfãos\n\n${markdownList(report.orphaned, "Nenhum.")}\n`;
}

async function main() {
  const catalogPath = path.join(ROOT, "src/site-visual-assets.ts");
  if (!(await exists(catalogPath))) {
    throw new Error("Catálogo src/site-visual-assets.ts não encontrado.");
  }

  const [textFiles, publicFiles, catalogContent] = await Promise.all([
    collectTextFiles(),
    collectPublicImages(),
    fs.readFile(catalogPath, "utf8"),
  ]);
  const usages = await collectUsages(textFiles);
  const report = buildAuditReport({
    usages,
    catalogKeys: extractCatalogKeys(catalogContent),
    publicFiles,
  });

  const artifactsDirectory = path.join(ROOT, "artifacts");
  await fs.mkdir(artifactsDirectory, { recursive: true });
  await fs.writeFile(
    path.join(artifactsDirectory, "image-library-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  if (!JSON_ONLY) {
    await fs.writeFile(
      path.join(artifactsDirectory, "image-library-audit.md"),
      renderMarkdown(report),
    );
  }

  console.log(`Auditoria concluída: ${report.totals.references} referências, ${report.totals.unregistered} não cadastradas, ${report.totals.missing} quebradas.`);
  process.exitCode = auditExitCode(report, STRICT);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
