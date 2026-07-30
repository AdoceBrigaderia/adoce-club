#!/usr/bin/env node
import { resolve } from "node:path";
import { assertRpcSurface } from "./rpc-surface-audit-core.mjs";

try {
  const result = assertRpcSurface(resolve(process.cwd()));
  console.log(
    JSON.stringify(
      {
        ok: true,
        schema_version: result.schemaVersion,
        operation_bff: result.operationBffCount,
        client_bff: result.clientBffCount,
        dedicated_authenticated: result.dedicatedAuthenticatedCount,
        public_compatibility_authenticated:
          result.publicCompatibilityAuthenticatedCount,
        authenticated_total: result.authenticatedCount,
        anonymous_total: result.anonymousCount,
        transaction_version_pairs: result.transactionVersionPairCount,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
