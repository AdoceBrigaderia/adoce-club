import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const responseSecuritySource = readFileSync(
  new URL("../netlify/functions/_shared/response-security.ts", import.meta.url),
  "utf8",
);
const sessionSecuritySource = readFileSync(
  new URL("../netlify/functions/_shared/session-security.ts", import.meta.url),
  "utf8",
);

const baselineHeaders = [
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "X-Permitted-Cross-Domain-Policies",
  "Referrer-Policy",
  "Permissions-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Content-Security-Policy",
];

test("mantém um único proprietário para o baseline de headers", () => {
  baselineHeaders.forEach((header) => {
    assert.match(responseSecuritySource, new RegExp(`['\"]${header}['\"]`));
    assert.doesNotMatch(sessionSecuritySource, new RegExp(`['\"]${header}['\"]`));
  });
});

test("secureJson reutiliza a mesma fronteira de secureText e secureEmpty", () => {
  assert.match(
    sessionSecuritySource,
    /import\s+\{\s*secureResponseHeaders\s*\}\s+from\s+["']\.\/response-security["']/,
  );
  assert.match(
    sessionSecuritySource,
    /secureResponseHeaders\(\{[\s\S]*contentType:\s*["']application\/json; charset=utf-8["']/,
  );
  assert.match(
    sessionSecuritySource,
    /vary:\s*["']Cookie, Origin, Sec-Fetch-Site["']/,
  );
  assert.match(responseSecuritySource, /export function secureText/);
  assert.match(responseSecuritySource, /export function secureEmpty/);
});

test("a resposta JSON preserva cookies depois de construir o baseline", () => {
  const secureJsonBody = sessionSecuritySource.match(
    /export function secureJson\([\s\S]*?\n\}/,
  )?.[0] || "";
  assert.match(secureJsonBody, /appendCookies\(\s*secureResponseHeaders\(/);
  assert.match(secureJsonBody, /cookies,/);
  assert.match(secureJsonBody, /JSON\.stringify\(body\)/);
});
