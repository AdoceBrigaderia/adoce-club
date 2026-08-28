import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("experiência comercial pública", () => {
  const home = readFileSync(new URL("./MarketingLanding.tsx", import.meta.url), "utf8");
  const catalog = readFileSync(new URL("./CommercialCatalog.tsx", import.meta.url), "utf8");
  const carousel = readFileSync(new URL("./CommercialMediaCarousel.tsx", import.meta.url), "utf8");

  it("usa a foto real e apresenta os caminhos comerciais no início da jornada", () => {
    expect(home).toContain('/site/portal-entry-fatias.png');
    expect(home).toContain('/adoce-hoje/chocolatudo.webp');
    expect(home).toContain('href="/#encomendas"');
    expect(home).toContain('href="/#adoce-hoje"');
  });

  it("segue a nova entrada comercial Mobile First", () => {
    expect(home).toContain("Bem-vindo à");
    expect(home).toContain("Fazer meu pedido");
    expect(home).toContain("Ver fatias disponíveis");
    expect(home).not.toContain("app-pickup-card");
    expect(home).toContain("Tortas incríveis");
    expect(home).toContain("Fatias generosas");
    expect(home).not.toContain("app-benefit-strip");
  });

  it("leva a ação principal para a montagem do pedido sem expor dados internos", () => {
    expect(home).toContain('className="home-reference-order" href="/#adoce-hoje"');
    expect(home).not.toContain("faturamento");
  });

  it("troca erros técnicos do catálogo por recuperação amigável", () => {
    expect(catalog).toContain("As opções não carregaram desta vez.");
    expect(catalog).toContain("Tentar novamente");
    expect(catalog).toContain("Falar no WhatsApp");
    expect(catalog).not.toContain(": error.message;");
  });

  it("mantém os cartões comerciais com descrições reais e sem textos genéricos repetidos", () => {
    expect(catalog).toContain("{product.short_description}");
    expect(catalog).not.toContain("Veja os docinhos por inteiro");
    expect(catalog).not.toContain('className="commercial-choice-flow"');
    expect(catalog).toContain("commercial-shared-packages");
    expect(carousel).not.toContain("Foto real Adoce");
  });
});
