import { describe, expect, it } from "vitest";
import { buildAccessLink } from "../netlify/functions/_shared/access-link";

describe("link temporario de acesso do Clube", () => {
  it("monta uma URL HTTPS com e-mail e codigo codificados", () => {
    const access = buildAccessLink(
      "cliente@membro.adocebrigaderia.com.br",
      "123456",
    );
    expect(access.loginUrl).toBe(
      "https://www.adocebrigaderia.com.br/clube/acesso-direto?email=cliente%40membro.adocebrigaderia.com.br&code=123456",
    );
    expect(new URL(access.loginUrl).pathname).toBe("/clube/acesso-direto");
  });

  it("recusa origem, e-mail ou codigo invalidos", () => {
    expect(() => buildAccessLink("cliente@example.com", "12345")).toThrow();
    expect(() =>
      buildAccessLink("cliente@example.com", "123456", "http://localhost:5173"),
    ).toThrow();
  });
});
