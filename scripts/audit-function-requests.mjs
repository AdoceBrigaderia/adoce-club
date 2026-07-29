#!/usr/bin/env node
import { resolve } from "node:path";
import { assertRequestSecurityInventory } from "./request-security-inventory-core.mjs";

const repositoryRoot = resolve(
  process.env.ADOCE_REQUEST_SECURITY_ROOT || process.cwd(),
);
const result = assertRequestSecurityInventory(repositoryRoot);

console.log(
  JSON.stringify(
    {
      ok: true,
      entrypoints: result.entrypoints.length,
      guardedEntrypoints: result.guardedEntrypoints,
      externalSignedEntrypoints: result.externalSignedEntrypoints,
      externalException: "whatsapp-cloud-webhook.ts",
    },
    null,
    2,
  ),
);
