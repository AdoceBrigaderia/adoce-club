import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUSINESS_CONTACTS, businessMailto } from "./business-contacts";
import { publicContactLinks } from "./public-contact-links";

const legalPage = readFileSync(
  new URL("./LegalPage.tsx", import.meta.url),
  "utf8",
);
const feedbackPage = readFileSync(
  new URL("./FeedbackPage.tsx", import.meta.url),
  "utf8",
);
const contactDock = readFileSync(
  new URL("./PublicContactDock.tsx", import.meta.url),
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
    expect(publicContactLinks.emailAtendimento).toContain(
      "mailto:atendimento@adocebrigaderia.com.br",
    );
  });

  it("substitui o e-mail pessoal nos documentos legais", () => {
    expect(legalPage).not.toContain("fcorbz@gmail.com");
    expect(legalPage).toContain('businessMailto("privacidade"');
    expect(legalPage).toContain('businessMailto("atendimento"');
    expect(legalPage).toContain("Versão 1.2");
  });

  it("mantém um canal oficial quando o formulário estiver indisponível", () => {
    expect(feedbackPage).toContain('"atendimento",');
    expect(feedbackPage).toContain("BUSINESS_CONTACTS.atendimento.email");
    expect(feedbackPage).toContain(
      "Não foi possível conectar ao atendimento agora.",
    );
  });

  it("oferece o e-mail oficial junto aos canais públicos", () => {
    expect(contactDock).toContain("publicContactLinks.emailAtendimento");
    expect(contactDock).toContain("Canal oficial de atendimento");
  });
});
