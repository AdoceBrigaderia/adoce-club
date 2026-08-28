import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("linguagem pública da Adoce", () => {
  const today = readFileSync(new URL("./AdoceHoje.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("./MarketingLanding.tsx", import.meta.url), "utf8");
  const catalog = readFileSync(new URL("./CommercialCatalog.tsx", import.meta.url), "utf8");
  const pedeJunto = readFileSync(new URL("./GroupOrderPage.tsx", import.meta.url), "utf8");

  it("fala em disponibilidade de sabores em vez de termos internos", () => {
    expect(today).toContain("Sabores disponíveis hoje");
    expect(today).toContain(">Hoje</button>");
    expect(today).toContain("Disponível hoje");
    expect(today).not.toContain("Sinalizados hoje");
    expect(today).not.toContain("Sinalizado hoje");
  });

  it("deixa o cuidado aparecer no texto sem repetir promessas de honestidade", () => {
    const publicCopy = [today, home, catalog, pedeJunto].join("\n").toLowerCase();

    expect(publicCopy).not.toContain("informação honesta");
    expect(publicCopy).not.toContain("condições reais");
    expect(publicCopy).not.toContain("serviço de verdade");
    expect(publicCopy).not.toContain("cuidado de verdade");
    expect(publicCopy).not.toContain("sem promessas vagas");
    expect(publicCopy).not.toContain("funcionamento real do dia");
  });
});
