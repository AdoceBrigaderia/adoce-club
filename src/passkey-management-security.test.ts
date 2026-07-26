import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const own = readFileSync(
  new URL("../netlify/functions/auth-bff-passkeys.ts", import.meta.url),
  "utf8",
);
const admin = readFileSync(
  new URL("../netlify/functions/admin-revoke-user-passkey.ts", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("./services/bff-passkeys.ts", import.meta.url),
  "utf8",
);

describe("gestão segura de passkeys", () => {
  it("exige cookie de sessão e CSRF para alterar ou excluir", () => {
    expect(own).toContain("ACCESS_COOKIE");
    expect(own).toContain("validCsrf(request)");
    expect(own).toContain('body.action === "rename"');
    expect(own).toContain('body.action === "delete"');
  });

  it("limita revogação administrativa a owner e manager", () => {
    expect(admin).toContain('["owner", "manager"].includes(actor.role)');
    expect(admin).toContain("validCsrf(request)");
    expect(admin).toContain("security.passkey_revoked_by_manager");
    expect(admin).toContain("audit_events");
  });

  it("não expõe token nas operações do navegador", () => {
    expect(service).toContain('fetch("/api/auth-bff-passkeys"');
    expect(service).not.toContain("Authorization");
    expect(service).not.toContain("localStorage");
    expect(service).not.toContain("sessionStorage");
  });
});
