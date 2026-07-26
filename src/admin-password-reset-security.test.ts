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

  it("valida origem e perfil gestor antes de redefinir", () => {
    expect(functionSource).toContain("if (!allowedOrigin(request))");
    expect(functionSource).toContain('["owner", "manager"].includes(actor.role)');
    expect(functionSource).toContain("auth.getUser(accessToken)");
  });

  it("mantém troca obrigatória e auditoria", () => {
    expect(functionSource).toContain("must_change_password: true");
    expect(functionSource).toContain('action: "security.password_reset_by_manager"');
    expect(functionSource).toContain("Cache-Control");
    expect(functionSource).toContain("no-store");
  });
});
