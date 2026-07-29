import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(
  new URL("../netlify/functions/admin-reset-user-password.ts", import.meta.url),
  "utf8",
);

describe("redefinição administrativa de senha", () => {
  it("não utiliza credencial temporária fixa ou previsível", () => {
    expect(functionSource).not.toContain("123456@adoce");
    expect(functionSource).toContain("generateTemporaryPassword()");
    expect(functionSource).toContain("temporary_password_generated_randomly: true");
  });

  it("usa cookies HttpOnly, origem central, CSRF e perfil gestor", () => {
    expect(functionSource).toContain("guardBffRequest(request");
    expect(functionSource).toContain('methods: ["POST"]');
    expect(functionSource).toContain('configuredSiteUrl: env("SITE_URL")');
    expect(functionSource).toContain("requireCsrf: true");
    expect(functionSource).toContain('cookies.get(SURFACE_COOKIE) !== "operation"');
    expect(functionSource).toContain("cookies.get(ACCESS_COOKIE)");
    expect(functionSource).not.toContain('request.headers.get("authorization")');
    expect(functionSource).not.toContain("allowedOrigin(request");
    expect(functionSource).not.toContain("validCsrf(request)");
    expect(functionSource).toContain('["owner", "manager"].includes(actor.role)');
    expect(functionSource).toContain("auth.getUser(accessToken)");
  });

  it("mantém troca obrigatória, expiração curta e auditoria", () => {
    expect(functionSource).toContain("must_change_password: true");
    expect(functionSource).toContain("2 * 60 * 60 * 1000");
    expect(functionSource).toContain('action: "security.password_reset_by_manager"');
    expect(functionSource).toContain("secureJson(");
  });
});
