import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("acesso da operação com senha", () => {
  it("usa celular e senha como acesso principal da equipe", () => {
    const app = source("./AccessApp.tsx");
    expect(app).toContain(
      "await signInWithStaffPhonePassword(phone, password, rememberLogin)",
    );
    expect(app).toContain('surface === "operation" ? "Entrar com senha"');
    expect(app).toContain("Use seu celular com DDD e a senha da operação.");
    expect(app).toContain('placeholder="(85) 99999-9999"');
  });

  it("autentica pelo endpoint protegido sem expor o e-mail interno", () => {
    const auth = source("./services/auth.ts");
    const endpoint = source("../netlify/functions/staff-phone-login.ts");
    expect(auth).toContain('fetch("/api/staff-phone-login"');
    expect(endpoint).toContain('.eq("phone_e164", phone)');
    expect(endpoint).toContain('.from("staff_members")');
    expect(endpoint).toContain('"Celular ou senha incorretos."');
  });

  it("obriga a troca da senha temporária no primeiro acesso", () => {
    const app = source("./AccessApp.tsx");
    const migration = source(
      "../supabase/migrations/20260723101500_forced_password_change.sql",
    );
    expect(app).toContain("if (mustChangePassword)");
    expect(app).toContain('"complete_forced_password_change"');
    expect(migration).toContain("must_change_password boolean");
  });
});
