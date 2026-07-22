import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("experiência comercial pública", () => {
  const home = readFileSync(new URL("./MarketingLanding.tsx", import.meta.url), "utf8");
  const catalog = readFileSync(new URL("./CommercialCatalog.tsx", import.meta.url), "utf8");

  it("apresenta Beth como fundadora com uma fotografia real e contexto humano", () => {
    expect(home).toContain('/site/beth-fundadora.png');
    expect(home).toContain('Fundadora e confeiteira da Adoce');
    expect(home).toContain('artesanal não é uma palavra bonita');
  });

  it("transforma a home em uma entrada comercial guiada e humana", () => {
    expect(home).toContain("Feito pelas mãos da Beth.");
    expect(home).toContain("O que trouxe você até a Adoce hoje?");
    expect(home).toContain("Quero uma doçura para hoje.");
    expect(home).toContain("Estou planejando algo especial.");
    expect(home).toContain("Fotos e condições reais");
    expect(home).toContain("Cada pessoa escolhe e paga a sua.");
    expect(home).toContain("Cada fatia vira um carinho de volta.");
  });

  it("usa ícones para as redes sociais sem exibir URLs", () => {
    expect(home).toContain("<FaInstagram />");
    expect(home).toContain("<FaFacebookF />");
  });

  it("troca erros técnicos do catálogo por recuperação amigável", () => {
    expect(catalog).toContain("As opções não carregaram desta vez.");
    expect(catalog).toContain("Tentar novamente");
    expect(catalog).toContain("Falar no WhatsApp");
    expect(catalog).not.toContain(": error.message;");
  });
});
