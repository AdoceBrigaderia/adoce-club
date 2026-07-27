import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("acesso da operação com senha", () => {
  it("usa celular e senha como fallback principal da equipe", () => {
    const gateway = source("./PasskeyOperationGateway.tsx");
    expect(gateway).toContain(
      'bffPasswordLogin({ phone, password, surface: "operation", remember })',
    );
    expect(gateway).toContain("Use a biometria do celular");
    expect(gateway).toContain("ou use a senha");
    expect(gateway).toContain('placeholder="(85) 99999-9999"');
    expect(gateway).toContain("Entrar na operação");
  });

  it("autentica pelo BFF sem devolver tokens ao JavaScript", () => {
    const auth = source("./services/bff-auth.ts");
    const endpoint = source("../netlify/functions/auth-bff-login.ts");
    expect(auth).toContain('fetch("/api/auth-bff-login"');
    expect(auth).toContain('credentials: "same-origin"');
    expect(auth).not.toContain("access_token");
    expect(auth).not.toContain("refresh_token");
    expect(endpoint).toContain("createSessionCookies");
    expect(endpoint).toContain("secureJson");
  });

  it("bloqueia o acesso enquanto a senha temporária precisar ser trocada", () => {
    const gateway = source("./PasskeyOperationGateway.tsx");
    const migration = source(
      "../supabase/migrations/20260723101500_forced_password_change.sql",
    );
    expect(gateway).toContain("if (next.mustChangePassword)");
    expect(gateway).toContain("await bffLogout()");
    expect(gateway).toContain("senha temporária precisa ser trocada");
    expect(migration).toContain("must_change_password boolean");
  });
});
