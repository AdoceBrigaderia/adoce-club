import assert from "node:assert/strict";
import test from "node:test";
import {
  auditBrowserFiles,
  auditBrowserSource,
  isAuditableSource,
} from "./browser-security-audit-core.mjs";

test("ignora testes, declarações, protótipos e arquivos sem código", () => {
  assert.equal(isAuditableSource("src/example.test.ts"), false);
  assert.equal(isAuditableSource("scripts/example.d.mts"), false);
  assert.equal(isAuditableSource("src/LegacyPrototype.tsx"), false);
  assert.equal(isAuditableSource("src/styles.css"), false);
  assert.equal(isAuditableSource("src/OperationBusinessHub.tsx"), true);
});

test("inclui entradas HTML e scripts públicos realmente entregues ao navegador", () => {
  assert.equal(isAuditableSource("index.html"), true);
  assert.equal(isAuditableSource("public/checkout.html"), true);
  assert.equal(isAuditableSource("public/runtime.js"), true);
  assert.equal(isAuditableSource("public/logo.svg"), false);
});

test("bloqueia sessão Supabase manipulada em superfície real", () => {
  const findings = auditBrowserSource(
    "src/PasskeyClientGateway.tsx",
    "await supabase.auth.setSession({ access_token, refresh_token });",
  );
  assert.ok(
    findings.some(
      (item) =>
        item.id === "browser-session-api" && item.severity === "critical",
    ),
  );
  assert.ok(
    findings.some(
      (item) =>
        item.id === "token-response-shape" && item.severity === "critical",
    ),
  );
});

test("bloqueia reintrodução de autenticação antiga mesmo usando nome legado", () => {
  const findings = auditBrowserSource(
    "src/AccessApp.tsx",
    "await supabase.auth.setSession({ access_token, refresh_token });",
  );
  assert.ok(findings.length >= 3);
  assert.ok(findings.every((item) => item.severity === "critical"));
  assert.ok(findings.every((item) => item.developmentOnly === false));
});

test("segredos permanecem críticos em qualquer módulo do navegador", () => {
  const findings = auditBrowserSource(
    "src/AccessApp.tsx",
    "const secret = import.meta.env.VITE_META_APP_SECRET;",
  );
  assert.ok(
    findings.some(
      (item) =>
        item.id === "client-secret-environment" && item.severity === "critical",
    ),
  );
});

test("bloqueia armazenamento persistente em contexto de autenticação", () => {
  const findings = auditBrowserSource(
    "src/CustomerAccess.tsx",
    'localStorage.setItem("auth-token", token);',
  );
  assert.ok(
    findings.some(
      (item) =>
        item.id === "persistent-auth-storage" && item.severity === "critical",
    ),
  );
});

test("bloqueia armazenamento de token mesmo quando a variável vem da linha anterior", () => {
  const findings = auditBrowserSource(
    "public/legacy-login.html",
    `<script>\nconst token = payload.jwt;\nsessionStorage.setItem("login", token);\n</script>`,
  );
  assert.ok(findings.some((item) => item.id === "persistent-auth-storage"));
});

test("não confunde sessionStorage operacional com sessão de autenticação", () => {
  const findings = auditBrowserSource(
    "src/CustomerCheckInPage.tsx",
    'sessionStorage.setItem("checkin-operation-key", crypto.randomUUID());',
  );
  assert.equal(findings.length, 0);
});

test("não confunde recuperação de chunk Vite com recuperação de senha", () => {
  const findings = auditBrowserSource(
    "src/main.tsx",
    'const lastReload = recoveryTimestamp(sessionStorage); sessionStorage.setItem(PRELOAD_RECOVERY_STORAGE_KEY, String(Date.now()));',
  );
  assert.equal(findings.length, 0);
});

test("não bloqueia localStorage usado somente para preferência visual", () => {
  const findings = auditBrowserSource(
    "src/ThemePreference.ts",
    'localStorage.setItem("theme", "dark");',
  );
  assert.equal(findings.length, 0);
});

test("não associa texto documental distante a armazenamento visual", () => {
  const findings = auditBrowserSource(
    "public/documentacao/index.html",
    `<p>Autenticação segura por cookie HttpOnly.</p>\n<script>localStorage.setItem("theme", "dark");</script>`,
  );
  assert.equal(findings.length, 0);
});

test("bloqueia segredo exposto por variável VITE", () => {
  const findings = auditBrowserSource(
    "src/services/meta.ts",
    "const secret = import.meta.env.VITE_META_APP_SECRET;",
  );
  assert.ok(findings.some((item) => item.id === "client-secret-environment"));
});

test("bloqueia cabeçalho Bearer manual em superfície do navegador", () => {
  const findings = auditBrowserSource(
    "src/services/customer.ts",
    'fetch("/api/example", { headers: { Authorization: `Bearer ${token}` } });',
  );
  assert.ok(
    findings.some(
      (item) =>
        item.id === "bearer-token-in-browser" && item.severity === "critical",
    ),
  );
});

test("bloqueia credenciais em query string ou fragmento", () => {
  const queryFindings = auditBrowserSource(
    "index.html",
    '<script>const params = new URLSearchParams(location.search); params.get("access_token");</script>',
  );
  const hashFindings = auditBrowserSource(
    "public/callback.html",
    '<script>const raw = window.location.hash; if (raw.includes("refresh_token")) consume(raw);</script>',
  );
  assert.ok(queryFindings.some((item) => item.id === "token-in-url-api"));
  assert.ok(hashFindings.some((item) => item.id === "token-in-url-api"));
});

test("bloqueia criação de cookie de autenticação pelo JavaScript", () => {
  const findings = auditBrowserSource(
    "public/session.html",
    '<script>document.cookie = `session_token=${token}; Secure; SameSite=Strict`;</script>',
  );
  assert.ok(
    findings.some(
      (item) =>
        item.id === "browser-auth-cookie-write" && item.severity === "critical",
    ),
  );
});

test("SDK Supabase direto gera alerta, mas tipo puro e adaptador central são permitidos", () => {
  const direct = auditBrowserSource(
    "src/CustomerData.ts",
    'import { createClient } from "@supabase/supabase-js";',
  );
  const typeOnly = auditBrowserSource(
    "src/OperationBusinessStructure.tsx",
    'import type { Session } from "@supabase/supabase-js";',
  );
  const central = auditBrowserSource(
    "src/lib/supabase.ts",
    'import { createClient } from "@supabase/supabase-js";',
  );
  assert.ok(direct.some((item) => item.id === "direct-supabase-sdk-import"));
  assert.equal(typeOnly.length, 0);
  assert.equal(central.length, 0);
});

test("relatório permite somente alertas não sensíveis e reprova sessão direta", () => {
  const warningOnly = auditBrowserFiles([
    {
      path: "src/PublicCatalog.ts",
      source: 'import { createClient } from "@supabase/supabase-js";',
    },
    {
      path: "src/OperationContentAdmin.tsx",
      source: 'import type { Session } from "@supabase/supabase-js";',
    },
  ]);
  assert.equal(warningOnly.passed, true);
  assert.equal(warningOnly.warnings.length, 1);
  assert.equal(warningOnly.critical.length, 0);

  const blocked = auditBrowserFiles([
    {
      path: "src/services/auth.ts",
      source: "await client.auth.getSession();",
    },
  ]);
  assert.equal(blocked.passed, false);
  assert.equal(blocked.critical.length, 1);
});
