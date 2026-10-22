import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("experiência comercial pública", () => {
  const catalog = readFileSync(new URL("./CommercialCatalog.tsx", import.meta.url), "utf8");
  const carousel = readFileSync(new URL("./CommercialMediaCarousel.tsx", import.meta.url), "utf8");

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
