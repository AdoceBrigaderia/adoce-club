import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");

describe("cadastro rápido do Clube Adoce", () => {
  it("reúne os dados e a senha antes do único código de confirmação", () => {
    expect(access).toContain("Criar meu cartão");
    expect(access).toContain('autoComplete="new-password"');
    expect(access).toContain("Crie uma senha com pelo menos 6 caracteres.");
    expect(access).toContain("checked={terms && privacy}");
    expect(access).toContain("Preferências de mensagens ficam para depois.");
  });

  it("cria o acesso definitivo e abre o cartão logo depois do código", () => {
    const verifyPosition = access.indexOf("const result = await verifyEmailCode(email, code)");
    const upgradePosition = access.indexOf("await upgradeCustomerSecurity(accessToken, phone, password)");
    const cardPosition = access.indexOf('location.hash = "clube"', upgradePosition);

    expect(verifyPosition).toBeGreaterThan(-1);
    expect(upgradePosition).toBeGreaterThan(verifyPosition);
    expect(cardPosition).toBeGreaterThan(upgradePosition);
    expect(access).toContain('registering ? "Abrir meu cartão"');
    expect(access).toContain("Esqueci a senha");
    expect(access).toContain("requestPasswordReset");
  });

  it("não reaproveita uma tentativa anterior de recuperação para pedir a senha de novo", () => {
    const requestStart = access.indexOf("const submitEmail = async");
    const requestEnd = access.indexOf("const submitPassword = async", requestStart);
    const requestFlow = access.slice(requestStart, requestEnd);
    const verificationStart = access.indexOf("const submitCode = async");
    const verificationEnd = access.indexOf("const confirmWhatsApp", verificationStart);
    const verificationFlow = access.slice(verificationStart, verificationEnd);

    expect(requestFlow).toContain(
      'if (surface === "client" && registering)',
    );
    expect(requestFlow).toContain(
      "sessionStorage.removeItem(passwordRecoveryStorageKey)",
    );
    expect(requestFlow).not.toContain(
      'sessionStorage.setItem(passwordRecoveryStorageKey, "true")',
    );
    expect(verificationFlow).toContain(
      'sessionStorage.setItem(passwordRecoveryStorageKey, "true")',
    );
    expect(
      verificationFlow.indexOf(
        "sessionStorage.removeItem(passwordRecoveryStorageKey)",
      ),
    ).toBeGreaterThan(
      verificationFlow.indexOf("if (registering && result.user)"),
    );
  });

  it("não obriga a confirmação do WhatsApp nem escolhas de marketing no cadastro", () => {
    const registrationCompletion = access.slice(
      access.indexOf("if (registering && result.user)"),
      access.indexOf('location.hash = surface === "operation"'),
    );
    expect(registrationCompletion).not.toContain('setStage("whatsapp")');
    expect(access).not.toContain("Quero receber sabores e novidades. <em>Opcional</em>");
  });
});
