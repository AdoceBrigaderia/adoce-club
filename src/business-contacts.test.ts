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
const contactsSource = readFileSync(
  new URL("./business-contacts.ts", import.meta.url),
  "utf8",
);
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const emailRunbook = readFileSync(
  new URL("../docs/business-email-groups.md", import.meta.url),
  "utf8",
);

const expectedPublic = {
  atendimento: "atendimento@adocebrigaderia.com.br",
  privacidade: "privacidade@adocebrigaderia.com.br",
} as const;

describe("canais oficiais da Adoce", () => {
  it("centraliza somente os canais que podem aparecer no navegador", () => {
    expect(
      Object.fromEntries(
        Object.entries(BUSINESS_CONTACTS).map(([key, value]) => [
          key,
          value.email,
        ]),
      ),
    ).toEqual(expectedPublic);
    expect(new Set(Object.values(expectedPublic)).size).toBe(2);
    Object.values(expectedPublic).forEach((email) => {
      expect(email).toMatch(/^[a-z-]+@adocebrigaderia\.com\.br$/);
    });
  });

  it("não inclui financeiro ou alertas no módulo carregado pelo browser", () => {
    expect(contactsSource).not.toContain("financeiro@adocebrigaderia.com.br");
    expect(contactsSource).not.toContain("alertas@adocebrigaderia.com.br");
    expect(emailRunbook).toContain("financeiro@adocebrigaderia.com.br");
    expect(emailRunbook).toContain("alertas@adocebrigaderia.com.br");
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
    expect(feedbackPage).toContain('? "privacidade" : "atendimento"');
    expect(feedbackPage).toContain("BUSINESS_CONTACTS[fallbackContact].email");
    expect(feedbackPage).toContain(
      "Não foi possível conectar ao atendimento agora.",
    );
  });

  it("oferece o e-mail oficial junto aos canais públicos", () => {
    expect(contactDock).toContain("publicContactLinks.emailAtendimento");
    expect(contactDock).toContain("Canal oficial de atendimento");
  });

  it("publica atendimento e privacidade nos dados estruturados", () => {
    expect(indexHtml).toContain('"contactType": "customer service"');
    expect(indexHtml).toContain('"contactType": "privacy"');
    expect(indexHtml).toContain(expectedPublic.atendimento);
    expect(indexHtml).toContain(expectedPublic.privacidade);
    expect(indexHtml).not.toContain("fcorbz@gmail.com");
    expect(indexHtml).not.toContain("financeiro@adocebrigaderia.com.br");
    expect(indexHtml).not.toContain("alertas@adocebrigaderia.com.br");
  });
});
