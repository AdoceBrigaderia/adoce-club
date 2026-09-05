import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

// O cliente nunca mais digita o próprio e-mail pra entrar ou se cadastrar —
// tudo passa a ser pelo WhatsApp (requestWhatsAppAuthCode/verifyWhatsAppAuthCode),
// reaproveitando o mesmo template do Twilio já aprovado para o código de
// recuperação de senha. request-email-code.ts foi apagada; verify-email-code.ts
// continua existindo só para validar o link de acesso enviado pelo WhatsApp
// quando a loja cadastra alguém no balcão (o e-mail ali é um identificador
// interno do Supabase, nunca digitado nem mostrado ao cliente).
describe("cadastro e login do cliente são só pelo WhatsApp", () => {
  it("request-email-code.ts não existe mais", () => {
    expect(() => source("../netlify/functions/request-email-code.ts")).toThrow();
  });

  it("AccessApp não pede e-mail para entrar ou se cadastrar", () => {
    const accessApp = source("./AccessApp.tsx");
    expect(accessApp).not.toContain('type="email"');
    expect(accessApp).not.toContain("requestEmailCode(");
    expect(accessApp).toContain("requestWhatsAppAuthCode(");
    expect(accessApp).toContain("verifyWhatsAppAuthCode(whatsappAuthChallengeId, phone, code)");
  });

  it("o pedido de código usa o mesmo endpoint de start do WhatsApp", () => {
    const auth = source("./services/auth.ts");
    expect(auth).toContain('fetch("/api/auth/whatsapp/start"');
    expect(auth).not.toContain('fetch("/api/request-email-code"');
    expect(auth).toContain('fetch("/api/verify-email-code"');
  });

  it("mantém o cadastro opcional e limita chamadas ao Supabase no início do desafio", () => {
    const startEndpoint = source("../netlify/functions/auth-whatsapp-start.ts");
    const verifyChallengeEndpoint = source("../netlify/functions/auth-whatsapp-verify.ts");
    expect(startEndpoint).toContain("create_user: true");
    expect(startEndpoint).toContain("isNewSignup");
    expect(startEndpoint).toContain("whatsappAuthEnabled()");
    const resetEndpoint = source("../netlify/functions/request-password-reset.ts");
    expect(resetEndpoint).toContain("/auth/v1/otp");
    expect(resetEndpoint).toContain("create_user: false");
    expect(resetEndpoint).toContain("whatsappAuthEnabled()");
    expect(resetEndpoint).not.toContain('type: "recovery"');
    expect(resetEndpoint).toContain("phone_e164");
    const verifyEndpoint = source("../netlify/functions/verify-email-code.ts");
    expect(verifyEndpoint).toContain('"email", "recovery", "magiclink"');
    expect(verifyEndpoint).toContain("signal: AbortSignal.timeout(20000)");
    expect(verifyChallengeEndpoint).toContain("signal: AbortSignal.timeout(20000)");
  });

  it("impede criar a conta antes de receber nome e sobrenome válidos", () => {
    const accessApp = source("./AccessApp.tsx");
    const validationPosition = accessApp.indexOf(
      "if (registering && !isRealCustomerName(name))",
    );
    const requestPosition = accessApp.indexOf("await requestWhatsAppAuthCode(");
    expect(validationPosition).toBeGreaterThan(-1);
    expect(requestPosition).toBeGreaterThan(validationPosition);
  });

  it("mantém o botão de cadastro disponível para novos clientes", () => {
    const accessApp = source("./AccessApp.tsx");
    expect(accessApp).toContain("setRegistering(!registering)");
    expect(accessApp).toContain(': "Quero fazer parte"');
    expect(accessApp).toContain("registrationRoute ||");
  });
});
