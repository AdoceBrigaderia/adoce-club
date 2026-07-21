import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("acesso da operação com senha", () => {
  it("usa e-mail e senha como acesso principal e mantém o código como alternativa", () => {
    const app = source("./AccessApp.tsx");
    expect(app).toContain('await signInWithEmailPassword(email, password, rememberLogin)');
    expect(app).toContain('surface === "operation" ? "Entrar com senha"');
    expect(app).toContain('"Entrar com código enviado por e-mail"');
    expect(app).toContain('"Entrar com e-mail e senha"');
  });

  it("autentica diretamente no Supabase sem expor detalhes da conta", () => {
    const auth = source("./services/auth.ts");
    expect(auth).toContain("auth.signInWithPassword({");
    expect(auth).toContain("email: normalizedEmail");
    expect(auth).toContain('throw new Error("E-mail ou senha incorretos.")');
  });
});
