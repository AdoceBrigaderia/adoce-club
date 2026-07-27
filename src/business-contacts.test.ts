import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUSINESS_CONTACTS, businessMailto } from "./business-contacts";

const legalPage = readFileSync(new URL("./LegalPage.tsx", import.meta.url), "utf8");
const feedbackPage = readFileSync(
  new URL("./FeedbackPage.tsx", import.meta.url),
  "utf8",
);

const expected = {
  atendimento: "atendimento@adocebrigaderia.com.br",
  financeiro: "financeiro@adocebrigaderia.com.br",
  alertas: "alertas@adocebrigaderia.com.br",
  privacidade: "privacidade@adocebrigaderia.com.br",
} as const;

describe("canais oficiais da Adoce", () => {
  it("centraliza os quatro grupos corporativos no domínio oficial", () => {
    expect(
      Object.fromEntries(
        Object.entries(BUSINESS_CONTACTS).map(([key, value]) => [
          key,
          value.email,
        ]),
      ),
    ).toEqual(expected);
    expect(new Set(Object.values(expected)).size).toBe(4);
    Object.values(expected).forEach((email) => {
      expect(email).toMatch(/^[a-z-]+@adocebrigaderia\.com\.br$/);
    });
  });

  it("gera mailto com assunto codificado sem expor credenciais", () => {
    expect(businessMailto("privacidade", "Excluir meu cadastro")).toBe(
      "mailto:privacidade@adocebrigaderia.com.br?subject=Excluir%20meu%20cadastro",
    );
  });

  it("substitui o e-mail pessoal nos documentos legais", () => {
    expect(legalPage).not.toContain("fcorbz@gmail.com");
    expect(legalPage).toContain('businessMailto("privacidade"');
    expect(legalPage).toContain('businessMailto("atendimento"');
    expect(legalPage).toContain("Versão 1.2");
  });

  it("mantém um canal oficial quando o formulário estiver indisponível", () => {
    expect(feedbackPage).toContain('businessMailto(\n                    "atendimento"');
    expect(feedbackPage).toContain("BUSINESS_CONTACTS.atendimento.email");
    expect(feedbackPage).toContain("Não foi possível conectar ao atendimento agora.");
  });
});
