import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import requestEmailCodeEndpoint, {
  isValidSignupFullName,
} from "../netlify/functions/request-email-code";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("código de acesso por e-mail", () => {
  it("envia e valida o código por rotas do próprio site", () => {
    const auth = source("./services/auth.ts");
    expect(auth).toContain('fetch("/api/request-email-code"');
    expect(auth).toContain('fetch("/api/verify-email-code"');
    expect(auth).not.toContain("auth.signInWithOtp({\n    email: normalizedEmail");
  });

  it("mantém o cadastro opcional e limita chamadas ao Supabase", () => {
    const requestEndpoint = source(
      "../netlify/functions/request-email-code.ts",
    );
    const verifyEndpoint = source(
      "../netlify/functions/verify-email-code.ts",
    );
    expect(requestEndpoint).toContain('create_user: Boolean(body.createUser)');
    expect(requestEndpoint).toContain("redirect_to: `${siteUrl}/#entrar`");
    expect(requestEndpoint).toContain("OTP_TIMEOUT_MS = 20000");
    expect(requestEndpoint).toContain("for (let attempt = 1; attempt <= 2; attempt += 1)");
    expect(requestEndpoint).not.toContain("generateLink");
    expect(requestEndpoint).not.toContain("sendWithAdminLink");
    expect(requestEndpoint).toContain("return await interpret(response)");
    const resetEndpoint = source("../netlify/functions/request-password-reset.ts");
    expect(resetEndpoint).toContain('type: "recovery"');
    expect(resetEndpoint).toContain("phone_e164");
    expect(requestEndpoint).toContain("timeout: 26");
    expect(verifyEndpoint).toContain('"email", "recovery", "magiclink"');
    expect(verifyEndpoint).toContain("signal: AbortSignal.timeout(20000)");
  });

  it("envia o OTP de uma conta existente antes de informar sucesso", async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_URL = "https://projeto.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const response = await requestEmailCodeEndpoint(
        new Request("https://www.adocebrigaderia.com.br/api/request-email-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://www.adocebrigaderia.com.br",
          },
          body: JSON.stringify({
            email: "cliente@example.com",
            createUser: false,
          }),
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ sent: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://projeto.supabase.co/auth/v1/otp");
      expect(JSON.parse(String(options.body))).toMatchObject({
        email: "cliente@example.com",
        create_user: false,
      });
    } finally {
      vi.unstubAllGlobals();
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
      else process.env.SUPABASE_PUBLISHABLE_KEY = previousKey;
    }
  });

  it("impede criar a conta antes de receber nome e sobrenome válidos", () => {
    expect(isValidSignupFullName("Cliente Adoce")).toBe(false);
    expect(isValidSignupFullName("Ana")).toBe(false);
    expect(isValidSignupFullName("Ana Maria")).toBe(true);
    expect(isValidSignupFullName("Maria de Fátima")).toBe(true);

    const accessApp = source("./AccessApp.tsx");
    const validationPosition = accessApp.indexOf(
      "if (registering && !isRealCustomerName(name))",
    );
    const requestPosition = accessApp.indexOf("await requestEmailCode(");
    expect(validationPosition).toBeGreaterThan(-1);
    expect(requestPosition).toBeGreaterThan(validationPosition);
  });

  it("mantém o botão de cadastro disponível para novos clientes", () => {
    const accessApp = source("./AccessApp.tsx");
    expect(accessApp).toContain('setRegistering(!registering)');
    expect(accessApp).toContain(': "Quero fazer parte"');
    expect(accessApp).toContain('registrationRoute ||');
  });

  it("encaminha automaticamente e-mail sem conta para o cadastro", () => {
    const accessApp = source("./AccessApp.tsx");
    expect(accessApp).toContain(
      'safeMessage === "Não encontramos uma conta ativa com este e-mail."',
    );
    expect(accessApp).toContain('setRegistering(true)');
    expect(accessApp).toContain(
      '"Este e-mail ainda não tem cadastro. Complete seus dados para fazer parte."',
    );
  });
});
