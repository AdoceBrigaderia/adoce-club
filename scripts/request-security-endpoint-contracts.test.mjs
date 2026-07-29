import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(
  process.env.ADOCE_REQUEST_SECURITY_ROOT || process.cwd(),
);

function source(path) {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

for (const path of [
  "netlify/functions/customer-phone-login.ts",
  "netlify/functions/staff-phone-login.ts",
]) {
  test(`${path} permanece aposentado atrás do guard central`, () => {
    const entrypoint = source(path);
    assert.equal((entrypoint.match(/guardBffRequest\(/g) || []).length, 1);
    assert.match(entrypoint, /methods: \["POST"\]/);
    assert.match(entrypoint, /configuredSiteUrl: env\("SITE_URL"\)/);
    assert.match(entrypoint, /legacy_phone_login_disabled/);
    assert.match(entrypoint, /410/);
    assert.doesNotMatch(entrypoint, /\ballowedOrigin\(/);
    assert.ok(
      entrypoint.indexOf("guardBffRequest(request") <
        entrypoint.indexOf("legacy_phone_login_disabled"),
    );
  });
}

test("readiness da homologação valida método e origem antes de ler o ambiente", () => {
  const entrypoint = source("netlify/functions/homologation-readiness.ts");
  assert.equal((entrypoint.match(/guardBffRequest\(/g) || []).length, 1);
  assert.match(entrypoint, /methods: \["GET", "HEAD"\]/);
  assert.match(entrypoint, /configuredSiteUrl: env\("SITE_URL"\)/);
  assert.doesNotMatch(entrypoint, /new Set\(\["GET", "HEAD"\]\)/);
  assert.ok(
    entrypoint.indexOf("guardBffRequest(request") <
      entrypoint.indexOf("const readiness = buildHomologationReadiness"),
  );
  assert.match(entrypoint, /return secureEmpty\(readiness\.coreReady \? 204 : 503\)/);
});

test("webhook da Meta é a única exceção externa e preserva assinatura", () => {
  const entrypoint = source("netlify/functions/whatsapp-cloud-webhook.ts");
  assert.doesNotMatch(entrypoint, /guardBffRequest\(/);
  assert.match(entrypoint, /verifyMetaWebhookSignature\(/);
  assert.match(entrypoint, /x-hub-signature-256/);
  assert.match(entrypoint, /timingSafeEqual\(/);
  assert.match(entrypoint, /request\.method === "GET"/);
  assert.match(entrypoint, /request\.method !== "POST"/);
  assert.match(entrypoint, /secureText\(/);
});
