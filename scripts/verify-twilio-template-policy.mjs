import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const roots = ["netlify/functions", "src", "scripts"];
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const ignored = new Set([
  "scripts/verify-twilio-template-policy.mjs",
  "src/twilio-template-governance.test.ts",
]);
const forbidden = [
  /\.contents\.create\s*\(/,
  /\.approvalCreate\s*\(/,
  /ApprovalRequests\/whatsapp/i,
];

function filesUnder(directory) {
  const absolute = join(root, directory);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) return filesUnder(relative(root, child));
    if (!entry.isFile() || !allowedExtensions.has(extname(entry.name))) return [];
    return [child];
  });
}

const violations = roots
  .flatMap(filesUnder)
  .filter((file) => statSync(file).isFile())
  .flatMap((file) => {
    const projectPath = relative(root, file).replaceAll("\\", "/");
    if (ignored.has(projectPath)) return [];
    const source = readFileSync(file, "utf8");
    return forbidden.some((pattern) => pattern.test(source)) ? [projectPath] : [];
  });

if (violations.length) {
  console.error(
    "Bloqueado: o sistema nao pode criar ou submeter templates da Twilio automaticamente sem autorizacao expressa do proprietario.\n" +
      violations.map((file) => `- ${file}`).join("\n"),
  );
  process.exit(1);
}

console.log("Politica Twilio verificada: nenhuma criacao ou submissao automatica de template.");
