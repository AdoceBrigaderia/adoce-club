import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auditScript = readFileSync(
  new URL("./audit-browser-security.mjs", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

test("auditoria cobre a aplicação compilada a partir de src, public e index.html", () => {
  assert.match(auditScript, /join\(repositoryRoot, "src"\)/);
  assert.match(auditScript, /join\(repositoryRoot, "public"\)/);
  assert.match(auditScript, /join\(repositoryRoot, "index\.html"\)/);
  assert.match(auditScript, /entry\.isSymbolicLink\(\)/);
});

test("gate integral executa testes de núcleo e de wiring antes da auditoria real", () => {
  const command = packageJson.scripts["test:browser-security-audit"];
  assert.match(command, /browser-security-audit-core\.test\.mjs/);
  assert.match(command, /browser-security-audit-wiring\.test\.mjs/);
  assert.equal(
    packageJson.scripts["audit:browser-security"],
    "node scripts/audit-browser-security.mjs",
  );
  assert.match(packageJson.scripts.verify, /test:browser-security-audit/);
  assert.match(packageJson.scripts.verify, /audit:browser-security/);
});
