#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertOrderTableSurface } from "./order-table-surface-audit-core.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

try {
  const result = assertOrderTableSurface(repositoryRoot);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
