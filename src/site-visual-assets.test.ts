import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE_VISUAL_ASSETS, SITE_VISUAL_PAGE_LINKS } from "./site-visual-assets";

describe("central de imagens institucionais", () => {
  it("não repete chaves e descreve corte e destino", () => {
    const keys = SITE_VISUAL_ASSETS.map((asset) => asset.key);
    expect(new Set(keys).size).toBe(keys.length);
    SITE_VISUAL_ASSETS.forEach((asset) => {
      expect(asset.key).toMatch(/^\/(site|adoce-hoje|wallet)\//);
      expect(asset.label.length).toBeGreaterThan(3);
      expect(asset.description.length).toBeGreaterThan(10);
      expect(asset.aspectWidth).toBeGreaterThan(0);
      expect(asset.aspectHeight).toBeGreaterThan(0);
      expect(asset.outputWidth).toBeGreaterThan(0);
      expect(["stretch", "cover", "contain"]).toContain(asset.fitMode);
      expect(SITE_VISUAL_PAGE_LINKS[asset.key]?.length).toBeGreaterThan(0);
      SITE_VISUAL_PAGE_LINKS[asset.key].forEach((destination) => {
        expect(destination.url).toMatch(/^https:\/\/www\.cantinhodaadoce\.com\.br\/(?:[-a-z]+)?$/);
      });
    });
  });

  it("define a foto de apoio do Clube como um corte 4:3 de preenchimento", () => {
    const hero = SITE_VISUAL_ASSETS.find((asset) => asset.key === "/site/hero-cake.webp");
    expect(hero).toMatchObject({ aspectWidth: 4, aspectHeight: 3, outputWidth: 1400, fitMode: "stretch" });
  });

  it("mostra na central a URL clicável de cada página que usa a imagem", () => {
    const source = readFileSync(new URL("./OperationVisualSettings.tsx", import.meta.url), "utf8");
    expect(source).toContain("SITE_VISUAL_PAGE_LINKS[definition.key].map");
    expect(source).toContain("destination.url");
    expect(source).toContain('target="_blank"');
  });

  it("só inclui fotos que algum componente do site realmente usa hoje", () => {
    const keys = new Set(SITE_VISUAL_ASSETS.map((asset) => asset.key));
    [
      "/site/logo.webp",
      "/site/clube-convite-pedido.webp",
      "/site/hero-cake.webp",
      "/site/adoce-hoje-retirada-ilustracao.webp",
      "/site/adoce-hoje-barraquinha-ilustracao.webp",
      "/adoce-hoje/sabores-hoje.webp",
    ].forEach((key) => expect(keys.has(key), key).toBe(true));
    // Removidas em 03/11/2026 por não serem renderizadas em nenhuma página:
    // a Home não usa mais nenhuma foto fixa, a política de pedidos é só
    // texto, e o Pede Junto foi desativado (sem rota no site).
    [
      "/site/trufado-de-ninho-home-20260803.png",
      "/site/beth-fundadora.png",
      "/site/clube-cartao-destaque-v2.webp",
      "/site/clube-aprovado-mobile-claro.png",
      "/site/clube-aprovado-mobile-escuro.png",
      "/site/clube-aprovado-desktop.png",
      "/site/pede-junto-pacotes.webp",
      "/site/pede-junto-trabalho.webp",
      "/site/pede-junto-condominio.webp",
      "/site/pede-junto-faculdade.webp",
      "/site/pede-junto-clinica.webp",
      "/site/adoce-hoje-exemplo-desktop.png",
      "/site/adoce-hoje-exemplo-mobile.png",
      "/site/politica-de-pedidos.jpeg",
    ].forEach((key) => expect(keys.has(key), key).toBe(false));
  });

  it("mantém RLS e escrita restrita a gerentes na migração", () => {
    const migration = readFileSync(
      new URL("../supabase/migrations/20260723031104_site_visual_assets.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("private.is_manager()");
    expect(migration).toContain("to anon");
    expect(migration).toContain("updated_by = (select auth.uid())");
  });
});
