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

const guardSource = source(
  "netlify/functions/_shared/request-security.ts",
);

const protectedEntrypoints = [
  {
    path: "netlify/functions/auth-bff-login.ts",
    methods: ["POST"],
    csrf: "none",
  },
  {
    path: "netlify/functions/auth-bff-session.ts",
    methods: ["GET"],
    csrf: "none",
  },
  {
    path: "netlify/functions/auth-bff-logout.ts",
    methods: ["POST"],
    csrf: "always",
  },
  {
    path: "netlify/functions/auth-bff-registration-request.ts",
    methods: ["POST"],
    csrf: "none",
  },
  {
    path: "netlify/functions/auth-bff-registration-complete.ts",
    methods: ["POST"],
    csrf: "none",
  },
  {
    path: "netlify/functions/auth-bff-rpc.ts",
    methods: ["POST"],
    csrf: "always",
  },
  {
    path: "netlify/functions/auth-bff-client-rpc.ts",
    methods: ["POST"],
    csrf: "always",
  },
  {
    path: "netlify/functions/auth-bff-dynamic-image-upload.ts",
    methods: ["POST"],
    csrf: "always",
  },
  {
    path: "netlify/functions/auth-bff-gallery-media-upload.ts",
    methods: ["POST"],
    csrf: "always",
  },
  {
    path: "netlify/functions/auth-bff-site-visual-upload.ts",
    methods: ["POST"],
    csrf: "always",
  },
  {
    path: "netlify/functions/auth-bff-passkeys.ts",
    methods: ["GET", "POST"],
    csrf: "post-only",
  },
  {
    path: "netlify/functions/admin-revoke-user-passkey.ts",
    methods: ["POST"],
    csrf: "always",
  },
  {
    path: "netlify/functions/admin-reset-user-password.ts",
    methods: ["POST"],
    csrf: "always",
  },
  {
    path: "netlify/functions/whatsapp-otp-request.ts",
    methods: ["POST"],
    csrf: "none",
  },
  {
    path: "netlify/functions/whatsapp-otp-verify.ts",
    methods: ["POST"],
    csrf: "none",
  },
  {
    path: "netlify/functions/google-wallet-pass.ts",
    methods: ["POST"],
    csrf: "always",
  },
  {
    path: "netlify/functions/meta-whatsapp-health.ts",
    methods: ["GET"],
    csrf: "none",
  },
];

const passkeyCeremonyEntrypoints = [
  "netlify/functions/auth-bff-passkey-start.ts",
  "netlify/functions/auth-bff-passkey-finish.ts",
];

function methodsPattern(methods) {
  return new RegExp(
    `methods: \\[${methods.map((method) => `"${method}"`).join(", ")}\\]`,
  );
}

function assertNoLocalRequestSecurity(entrypointSource) {
  assert.doesNotMatch(entrypointSource, /allowedOrigin\(/);
  assert.doesNotMatch(entrypointSource, /validCsrf\(/);
  assert.doesNotMatch(
    entrypointSource,
    /from "\.\/_shared\/session-security";[\s\S]*\ballowedOrigin\b/,
  );
}

test("o guard central falha fechado para método, preflight, origem e CSRF", () => {
  assert.match(guardSource, /method === "OPTIONS"/);
  assert.match(guardSource, /code: "cors_preflight_denied"/);
  assert.match(guardSource, /code: "method_not_allowed"/);
  assert.match(guardSource, /code: "origin_not_allowed"/);
  assert.match(guardSource, /code: "csrf_validation_failed"/);
  assert.match(guardSource, /allowedOrigin\(request, options\.configuredSiteUrl\)/);
  assert.match(guardSource, /export function guardBffCsrf\(/);
  assert.match(guardSource, /if \(options\.requireCsrf\) \{/);
  assert.match(guardSource, /return guardBffCsrf\(request\)/);
  assert.doesNotMatch(guardSource, /Access-Control-Allow-Origin/i);
  assert.doesNotMatch(guardSource, /Access-Control-Allow-Credentials/i);
});

for (const entrypoint of protectedEntrypoints) {
  test(`${entrypoint.path} usa exclusivamente o guard compartilhado`, () => {
    const entrypointSource = source(entrypoint.path);
    const guardCalls = entrypointSource.match(/guardBffRequest\(/g) || [];

    assert.equal(guardCalls.length, 1);
    assert.match(
      entrypointSource,
      /from "\.\/_shared\/request-security";/,
    );
    assert.match(entrypointSource, methodsPattern(entrypoint.methods));
    assert.match(entrypointSource, /configuredSiteUrl: env\("SITE_URL"\)/);
    assertNoLocalRequestSecurity(entrypointSource);

    if (entrypoint.csrf === "always") {
      assert.match(entrypointSource, /requireCsrf: true/);
    } else if (entrypoint.csrf === "post-only") {
      assert.match(
        entrypointSource,
        /requireCsrf: request\.method\.toUpperCase\(\) === "POST"/,
      );
    } else {
      assert.doesNotMatch(entrypointSource, /requireCsrf:/);
    }
  });
}

for (const path of passkeyCeremonyEntrypoints) {
  test(`${path} protege a cerimônia e exige CSRF somente no cadastro`, () => {
    const entrypointSource = source(path);
    const requestGuardCalls = entrypointSource.match(/guardBffRequest\(/g) || [];
    const csrfGuardCalls = entrypointSource.match(/guardBffCsrf\(/g) || [];

    assert.equal(requestGuardCalls.length, 1);
    assert.equal(csrfGuardCalls.length, 1);
    assert.match(entrypointSource, /guardBffCsrf, guardBffRequest/);
    assert.match(entrypointSource, /methods: \["POST"\]/);
    assert.match(entrypointSource, /configuredSiteUrl: env\("SITE_URL"\)/);
    assert.match(entrypointSource, /if \(action === "registration"\) \{/);
    assert.match(entrypointSource, /const csrfRejection = guardBffCsrf\(request\)/);
    assertNoLocalRequestSecurity(entrypointSource);
  });
}
