import { readFileSync } from "node:fs";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

export const requiredOperationFeatures = [
  "manager_get_costing_workspace_with_times",
  "manager_save_costing_sheet_with_times",
  "manager_create_costing_item_with_reference",
  "manager_get_costing_purchase_workspace",
  "manager_get_costing_suppliers",
  "manager_get_costing_purchase_catalog",
  "manager_save_costing_purchase_invoice_v2",
  "manager_edit_costing_purchase_invoice",
  "manager_get_costing_invoice_revisions",
  "Preparações cadastradas",
];

// Only inspect assets reachable from this build's entry point. An old chunk
// left in dist must never mask a missing feature in the actual application.
export function verifyOperationRelease(buildDirectory) {
  const root = resolve(buildDirectory);
  const pending = [resolve(root, "index.html")];
  const visited = new Set();
  let application = "";
  while (pending.length) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    const pathFromRoot = relative(root, file);
    if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) throw new Error("Asset fora do pacote de publicação.");
    visited.add(file);
    const content = readFileSync(file, "utf8");
    if (file.endsWith(".js")) application += content;
    for (const match of content.matchAll(/["'`]((?:\.\/|\.\.\/|\/?assets\/)[^"'`\s]+\.js)["'`]/g)) {
      const ref = match[1];
      pending.push(ref.startsWith("assets/") || ref.startsWith("/assets/")
        ? resolve(root, ref.replace(/^\//, "")) : resolve(dirname(file), ref));
    }
  }
  const missing = requiredOperationFeatures.filter(feature => !application.includes(feature));
  if (missing.length) throw new Error(`PUBLICAÇÃO BLOQUEADA: recursos da Operação ausentes no pacote: ${missing.join(", ")}`);
  return { assets: visited.size, features: requiredOperationFeatures.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = verifyOperationRelease(process.argv[2] || "dist");
    console.log(`Operação preservada no pacote: ${result.features} verificações em ${result.assets} arquivos alcançáveis.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
