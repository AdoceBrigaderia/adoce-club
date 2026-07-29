import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { auditFunctionResponseSecurity } from "./function-response-security-audit-core.mjs";

const root = process.cwd();
const functionsDirectory = path.join(root, "netlify", "functions");
const entries = await readdir(functionsDirectory, { withFileTypes: true });
const files = await Promise.all(
  entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts"),
    )
    .map(async (entry) => {
      const absolutePath = path.join(functionsDirectory, entry.name);
      return {
        path: path.relative(root, absolutePath),
        source: await readFile(absolutePath, "utf8"),
      };
    }),
);

const violations = auditFunctionResponseSecurity(files);
if (violations.length) {
  console.error(
    `Auditoria de respostas das Functions falhou com ${violations.length} ocorrência(s):`,
  );
  for (const violation of violations) {
    console.error(
      `- ${violation.path} [${violation.rule}]: ${violation.message}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log(
    `Auditoria de respostas das Functions aprovada: ${files.length} entradas usam a fronteira segura compartilhada.`,
  );
}
