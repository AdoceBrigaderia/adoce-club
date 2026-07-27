import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditBrowserFiles,
  isAuditableSource,
  relativeSourcePath,
} from "./browser-security-audit-core.mjs";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptsDirectory, "..");
const sourceRoot = join(repositoryRoot, "src");
const artifactsRoot = join(repositoryRoot, "artifacts");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const files = walk(sourceRoot)
  .map((absolutePath) => ({
    absolutePath,
    path: relativeSourcePath(repositoryRoot, absolutePath),
  }))
  .filter(({ path }) => isAuditableSource(path))
  .map(({ absolutePath, path }) => ({
    path,
    source: readFileSync(absolutePath, "utf8"),
  }));

const report = auditBrowserFiles(files);
mkdirSync(artifactsRoot, { recursive: true });
writeFileSync(
  join(artifactsRoot, "browser-security-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

const markdown = [
  "# Auditoria da fronteira de segurança do navegador",
  "",
  `- Arquivos analisados: **${report.filesScanned}**`,
  `- Violações críticas: **${report.critical.length}**`,
  `- Alertas: **${report.warnings.length}**`,
  `- Resultado: **${report.passed ? "APROVADO" : "REPROVADO"}**`,
  "",
  ...[...report.critical, ...report.warnings].flatMap((item) => [
    `## ${item.severity === "critical" ? "Crítico" : "Alerta"}: ${item.id}`,
    "",
    `- Arquivo: \`${item.path}:${item.line}\``,
    `- Motivo: ${item.description}`,
    `- Trecho: \`${item.excerpt.replaceAll("`", "'")}\``,
    "",
  ]),
];
writeFileSync(
  join(artifactsRoot, "browser-security-audit.md"),
  `${markdown.join("\n")}\n`,
);

for (const warning of report.warnings) {
  console.warn(
    `[alerta] ${warning.path}:${warning.line} ${warning.id} — ${warning.description}`,
  );
}

if (!report.passed) {
  for (const violation of report.critical) {
    console.error(
      `[crítico] ${violation.path}:${violation.line} ${violation.id} — ${violation.description}`,
    );
  }
  throw new Error(
    `Auditoria do navegador encontrou ${report.critical.length} violação(ões) crítica(s). Consulte artifacts/browser-security-audit.md.`,
  );
}

console.log(
  `Auditoria do navegador aprovada em ${report.filesScanned} arquivo(s), com ${report.warnings.length} alerta(s) não bloqueante(s).`,
);
