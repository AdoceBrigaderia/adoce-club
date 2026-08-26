import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const endpoint = readFileSync(
  new URL("../netlify/functions/customer-security-upgrade.ts", import.meta.url),
  "utf8",
);

describe("primeiro acesso seguro do cliente", () => {
  it("não bloqueia a criação da senha quando o WhatsApp ainda não foi confirmado", () => {
    expect(access).toContain('className="access-primary" disabled={busy}');
    expect(access).toContain("sem bloquear este acesso");
    expect(endpoint).not.toContain("Confirme este WhatsApp antes de criar a senha");
  });

  it("mantém o celular único e grava o número normalizado no perfil", () => {
    expect(endpoint).toContain('.eq("phone_e164", phone)');
    expect(endpoint).toContain("phone_e164: phone");
    expect(endpoint).toContain("Este celular já está ligado a outro cadastro");
  });

  it("aceita qualquer senha com pelo menos 6 caracteres", () => {
    expect(access).toContain("securityPassword.length < 6");
    expect(access).toContain('minLength={6}');
    expect(endpoint).toContain("password.length >= 6");
    expect(endpoint).not.toContain("/[A-Z]/");
    expect(endpoint).not.toContain("/[a-z]/");
  });
});
