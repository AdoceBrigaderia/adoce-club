import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  assertRequestSecurityInventory,
  auditRequestSecurityInventory,
} from "./request-security-inventory-core.mjs";

function createFixture(files) {
  const root = mkdtempSync(join(tmpdir(), "adoce-request-security-"));
  const functionsDirectory = join(root, "netlify/functions");
  mkdirSync(functionsDirectory, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(functionsDirectory, name), content, "utf8");
  }
  return root;
}

const guardedEntrypoint = `
import { guardBffRequest } from "./_shared/request-security";
const env = (name) => process.env[name];
export default async (request) => {
  const rejection = guardBffRequest(request, {
    methods: ["POST"],
    configuredSiteUrl: env("SITE_URL"),
  });
  if (rejection) return rejection;
  return null;
};
`;

const signedWebhook = `
import { timingSafeEqual } from "node:crypto";
import { verifyMetaWebhookSignature } from "./_shared/meta-whatsapp";
import { secureText } from "./_shared/response-security";
export default async (request) => {
  if (request.method === "GET") return secureText(String(timingSafeEqual));
  if (request.method !== "POST") return secureText("Método não permitido.", 405);
  verifyMetaWebhookSignature(
    await request.text(),
    request.headers.get("x-hub-signature-256"),
    "secret",
  );
  return secureText("EVENT_RECEIVED");
};
`;

test("aprova BFFs same-origin e a única exceção externa assinada", () => {
  const root = createFixture({
    "example-bff.ts": guardedEntrypoint,
    "whatsapp-cloud-webhook.ts": signedWebhook,
  });
  try {
    const result = assertRequestSecurityInventory(root);
    assert.equal(result.guardedEntrypoints, 1);
    assert.equal(result.externalSignedEntrypoints, 1);
    assert.deepEqual(result.violations, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reprova qualquer Function nova que contorne o guard central", () => {
  const root = createFixture({
    "unguarded.ts": "export default async () => new Response('ok');",
    "whatsapp-cloud-webhook.ts": signedWebhook,
  });
  try {
    const result = auditRequestSecurityInventory(root);
    assert.ok(
      result.violations.some(
        ({ file, code }) =>
          file === "unguarded.ts" && code === "bff_guard_count",
      ),
    );
    assert.throws(() => assertRequestSecurityInventory(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reprova downgrade da assinatura do webhook externo", () => {
  const root = createFixture({
    "example-bff.ts": guardedEntrypoint,
    "whatsapp-cloud-webhook.ts": `
      import { secureText } from "./_shared/response-security";
      export default async (request) => {
        if (request.method === "GET") return secureText("challenge");
        if (request.method !== "POST") return secureText("Método não permitido.", 405);
        return secureText("EVENT_RECEIVED");
      };
    `,
  });
  try {
    const result = auditRequestSecurityInventory(root);
    assert.ok(
      result.violations.some(
        ({ code }) => code === "meta_signature_verification",
      ),
    );
    assert.ok(
      result.violations.some(
        ({ code }) => code === "constant_time_verify_token",
      ),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("o inventário real não possui entrypoints fora das fronteiras aprovadas", () => {
  const repositoryRoot = resolve(
    process.env.ADOCE_REQUEST_SECURITY_ROOT || process.cwd(),
  );
  const result = assertRequestSecurityInventory(repositoryRoot);
  assert.ok(result.entrypoints.length > 0);
  assert.equal(result.externalSignedEntrypoints, 1);
  assert.equal(
    result.guardedEntrypoints + result.externalSignedEntrypoints,
    result.entrypoints.length,
  );
});
