import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertStoreRlsSurface } from "./store-rls-surface-audit-core.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const result = assertStoreRlsSurface(repositoryRoot);

process.stdout.write(`${JSON.stringify({
  ok: true,
  schemaVersion: result.schemaVersion,
  tableCount: result.tableCount,
  predicateCount: result.predicateCount,
}, null, 2)}\n`);
