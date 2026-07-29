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
    method: "POST",
    requiresCsrf: false,
  },
  {
    path: "netlify/functions/auth-bff-session.ts",
    method: "GET",
    requiresCsrf: false,
  },
  {
    path: "netlify/functions/auth-bff-logout.ts",
    method: "POST",
    requiresCsrf: true,
  },
];

test("o guard central falha fechado para método, preflight, origem e CSRF", () => {
  assert.match(guardSource, /method === "OPTIONS"/);
  assert.match(guardSource, /code: "cors_preflight_denied"/);
  assert.match(guardSource, /code: "method_not_allowed"/);
  assert.match(guardSource, /code: "origin_not_allowed"/);
  assert.match(guardSource, /code: "csrf_validation_failed"/);
  assert.match(guardSource, /allowedOrigin\(request, options\.configuredSiteUrl\)/);
  assert.match(guardSource, /options\.requireCsrf && !validCsrf\(request\)/);
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
      /import \{ guardBffRequest \} from "\.\/_shared\/request-security";/,
    );
    assert.match(
      entrypointSource,
      new RegExp(`methods: \\["${entrypoint.method}"\\]`),
    );
    assert.match(entrypointSource, /configuredSiteUrl: env\("SITE_URL"\)/);
    assert.doesNotMatch(entrypointSource, /allowedOrigin\(/);
    assert.doesNotMatch(entrypointSource, /validCsrf\(/);

    if (entrypoint.requiresCsrf) {
      assert.match(entrypointSource, /requireCsrf: true/);
    } else {
      assert.doesNotMatch(entrypointSource, /requireCsrf: true/);
    }
  });
}
