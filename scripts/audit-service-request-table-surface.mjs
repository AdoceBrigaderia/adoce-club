import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertServiceRequestTableSurface } from "./service-request-table-surface-audit-core.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const result = assertServiceRequestTableSurface(repositoryRoot);
console.log(
  JSON.stringify(
    {
      ok: true,
      schemaVersion: result.schemaVersion,
      tableCount: result.tableCount,
      parentScopedTableCount: result.parentScopedTableCount,
      evidenceCount: result.evidenceCount,
      lifecycleMigrationCount: result.lifecycleMigrationCount,
      controlledFileCount: result.controlledFileCount,
    },
    null,
    2,
  ),
);
