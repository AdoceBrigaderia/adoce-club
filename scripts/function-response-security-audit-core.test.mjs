import assert from "node:assert/strict";
import test from "node:test";
import { auditFunctionResponseSecurity } from "./function-response-security-audit-core.mjs";

const audit = (filePath, source) =>
  auditFunctionResponseSecurity([{ path: filePath, source }]);

test("aceita secureJson compartilhado", () => {
  assert.deepEqual(
    audit(
      "netlify/functions/example.ts",
      `
        import { secureJson } from "./_shared/session-security";
        export default () => secureJson({ ok: true });
      `,
    ),
    [],
  );
});

test("aceita secureText compartilhado", () => {
  assert.deepEqual(
    audit(
      "netlify/functions/webhook.ts",
      `
        import { secureText } from "./_shared/response-security";
        export default () => secureText("ok");
      `,
    ),
    [],
  );
});

test("aceita secureEmpty compartilhado", () => {
  assert.deepEqual(
    audit(
      "netlify/functions/readiness.ts",
      `
        import { secureEmpty } from "./_shared/response-security";
        export default () => secureEmpty(204);
      `,
    ),
    [],
  );
});

test("aceita secureRedirect compartilhado", () => {
  assert.deepEqual(
    audit(
      "netlify/functions/redirect.ts",
      `
        import { secureRedirect } from "./_shared/response-security";
        export default () => secureRedirect("/entrar");
      `,
    ),
    [],
  );
});

test("rejeita Response direto", () => {
  const violations = audit(
    "netlify/functions/unsafe.ts",
    `export default () => new Response("ok");`,
  );
  assert.deepEqual(
    violations.map((item) => item.rule),
    ["direct-response", "missing-shared-boundary"],
  );
});

test("rejeita Response.json", () => {
  const violations = audit(
    "netlify/functions/unsafe.ts",
    `export default () => Response.json({ ok: true });`,
  );
  assert.deepEqual(
    violations.map((item) => item.rule),
    ["response-json", "missing-shared-boundary"],
  );
});

test("rejeita Response.redirect", () => {
  const violations = audit(
    "netlify/functions/unsafe.ts",
    `export default () => Response.redirect("https://example.com");`,
  );
  assert.deepEqual(
    violations.map((item) => item.rule),
    ["response-redirect", "missing-shared-boundary"],
  );
});

test("rejeita Location montado localmente mesmo quando há outro helper seguro", () => {
  const violations = audit(
    "netlify/functions/unsafe.ts",
    `
      import { secureJson } from "./_shared/session-security";
      export default () => secureJson({ ok: false }, 302, [], { Location: "/login" });
    `,
  );
  assert.deepEqual(
    violations.map((item) => item.rule),
    ["local-redirect-header"],
  );
});

test("rejeita política CORS local em entrypoint", () => {
  const violations = audit(
    "netlify/functions/unsafe.ts",
    `
      import { secureText } from "./_shared/response-security";
      export default () => secureText("ok", 200, {
        "Access-Control-Allow-Origin": "*",
      });
    `,
  );
  assert.deepEqual(
    violations.map((item) => item.rule),
    ["local-cors-policy"],
  );
});

test("ignora módulos compartilhados e testes", () => {
  assert.deepEqual(
    auditFunctionResponseSecurity([
      {
        path: "netlify/functions/_shared/helper.ts",
        source: `new Response("ok")`,
      },
      {
        path: "netlify/functions/example.test.ts",
        source: `new Response("ok")`,
      },
    ]),
    [],
  );
});
