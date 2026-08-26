import { describe, expect, it } from "vitest";
import { buildSocialAuthRedirectUrl, normalizeBrazilPhone } from "./auth";

describe("normalizeBrazilPhone", () => {
  it("normaliza celular brasileiro", () => {
    expect(normalizeBrazilPhone("(11) 99999-0000")).toBe("+5511999990000");
  });

  it("preserva o código do Brasil", () => {
    expect(normalizeBrazilPhone("+55 11 99999-0000")).toBe("+5511999990000");
  });

  it("rejeita telefone incompleto", () => {
    expect(() => normalizeBrazilPhone("9999-0000")).toThrow("DDD");
  });

});

describe("buildSocialAuthRedirectUrl", () => {
  it("retorna ao Clube sem reaproveitar o hash da tela de login", () => {
    expect(
      buildSocialAuthRedirectUrl("https://clube.adoce.com.br/#entrar"),
    ).toBe("https://clube.adoce.com.br/?auth_return=clube");
  });

  it("remove parâmetros antigos de retorno antes de um novo acesso", () => {
    expect(
      buildSocialAuthRedirectUrl(
        "https://adoce.com.br/?code=antigo&error_description=falha#entrar",
      ),
    ).toBe("https://adoce.com.br/?auth_return=clube");
  });

  it("retorna à operação quando o acesso social parte da equipe", () => {
    expect(
      buildSocialAuthRedirectUrl(
        "https://adoce.com.br/#operacao",
        "operacao",
      ),
    ).toBe("https://adoce.com.br/?auth_return=operacao");
  });
});
