import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../netlify/functions/staff-access-code.ts", import.meta.url),
  "utf8",
);

describe("segurança da geração administrativa de OTP", () => {
  it("valida sessão, função da equipe e mantém a chave secreta no servidor", () => {
    expect(source).toContain("auth.getUser(accessToken)");
    expect(source).toContain('new Set(["owner", "manager", "attendant"])');
    expect(source).toContain('env("SUPABASE_SECRET_KEY")');
    expect(source).toContain("auth.admin.generateLink");
  });

  it("não grava o OTP na auditoria e limita novas gerações", () => {
    expect(source).toContain('action: "staff_access_code_generated"');
    expect(source).toContain("Date.now() - 60_000");
    const auditPayload = source.slice(source.indexOf("payload:"), source.indexOf("return json({"));
    expect(auditPayload).not.toContain("accessCode");
  });
});
