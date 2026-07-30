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

test("Vary sempre preserva as fronteiras de origem e contexto de navegação", () => {
  assert.match(
    responseSecuritySource,
    /REQUIRED_VARY_TOKENS\s*=\s*\[\s*["']Origin["']\s*,\s*["']Sec-Fetch-Site["']\s*\]/,
  );
  assert.match(
    responseSecuritySource,
    /composeVaryHeader\(options\.vary, headers\.get\(["']Vary["']\)\)/,
  );
  assert.match(
    responseSecuritySource,
    /composeVaryHeader\([\s\S]*requestedVary,[\s\S]*\.\.\.REQUIRED_VARY_TOKENS/,
  );
  assert.match(responseSecuritySource, /headers\.set\(["']Vary["'], protectedVary\)/);
  assert.doesNotMatch(
    responseSecuritySource,
    /headers\.set\(["']Vary["'],\s*options\.vary\s*\|\|/,
  );
});

test("a composição de Vary deduplica tokens sem perder casing canônico", () => {
  assert.match(responseSecuritySource, /const CANONICAL_VARY_TOKENS = new Map/);
  assert.match(responseSecuritySource, /const key = token\.toLowerCase\(\)/);
  assert.match(responseSecuritySource, /if \(!tokens\.has\(key\)\)/);
  assert.match(
    responseSecuritySource,
    /CANONICAL_VARY_TOKENS\.get\(key\) \|\| token/,
  );
});

test("Vary ignora wildcard e tokens inválidos antes de preservar o baseline", () => {
  assert.match(responseSecuritySource, /const VARY_TOKEN_PATTERN\s*=\s*\/\^/);
  assert.match(
    responseSecuritySource,
    /token === ["']\*["'][\s\S]*!VARY_TOKEN_PATTERN\.test\(token\)/,
  );
  assert.doesNotMatch(responseSecuritySource, /if \(wildcard\) return ["']\*["']/);
});

test("cache sensível não pode ser rebaixado por opções ou headers", () => {
  assert.match(
    responseSecuritySource,
    /SENSITIVE_CACHE_CONTROL\s*=\s*["']no-store, max-age=0["']/,
  );
  assert.match(
    responseSecuritySource,
    /headers\.set\(["']Cache-Control["'], SENSITIVE_CACHE_CONTROL\)/,
  );
  assert.doesNotMatch(responseSecuritySource, /cacheControl\?:/);
  assert.doesNotMatch(responseSecuritySource, /options\.cacheControl/);
});

test("redirecionamentos usam destino interno e status explícitos", () => {
  assert.match(responseSecuritySource, /export function secureRedirect/);
  assert.match(responseSecuritySource, /candidate\.startsWith\(["']\/["']\)/);
  assert.match(responseSecuritySource, /candidate\.startsWith\(["']\/\/["']\)/);
  assert.match(responseSecuritySource, /REDIRECT_STATUSES\.has\(status\)/);
  assert.match(responseSecuritySource, /Location: normalizeRedirectLocation\(location\)/);
});
