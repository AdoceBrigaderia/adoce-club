import { execFileSync } from "node:child_process";
import {
  PRODUCTION_APPROVAL_PHRASE,
  validateProductionApproval,
} from "./production-approval-core.mjs";

function currentCommit() {
  if (process.env.GITHUB_SHA?.trim()) return process.env.GITHUB_SHA.trim();
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const commit = currentCommit();
const result = validateProductionApproval(process.env, commit);

if (!result.approved) {
  console.error("\nPUBLICAÇÃO EM PRODUÇÃO BLOQUEADA\n");
  for (const failure of result.failures) console.error(`- ${failure}`);
  console.error(
    `\nA liberação exige aprovação expressa, vinculada ao commit atual e emitida nas últimas 24 horas. A frase obrigatória é ${PRODUCTION_APPROVAL_PHRASE}.`,
  );
  process.exit(1);
}

console.log("\nAPROVAÇÃO DE PRODUÇÃO VALIDADA");
console.log(`Responsável: ${result.approvedBy}`);
console.log(`Commit: ${result.approvedCommit}`);
console.log(`Aprovado em: ${result.approvedAt}\n`);
