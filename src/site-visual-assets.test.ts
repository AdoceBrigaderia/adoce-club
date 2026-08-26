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
        expect(destination.url).toMatch(/^https:\/\/www\.adocebrigaderia\.com\.br\/(#[-a-z]+)?$/);
      });
    });
  });

  it("define a primeira foto da Home como uma moldura quadrada de preenchimento total", () => {
    const hero = SITE_VISUAL_ASSETS.find((asset) => asset.key === "/site/trufado-de-ninho-home-20260803.png");
    expect(hero).toMatchObject({ aspectWidth: 1, aspectHeight: 1, outputWidth: 1400, fitMode: "cover" });
  });

  it("mostra na central a URL clicável de cada página que usa a imagem", () => {
    const source = readFileSync(new URL("./OperationVisualSettings.tsx", import.meta.url), "utf8");
    expect(source).toContain("SITE_VISUAL_PAGE_LINKS[definition.key].map");
    expect(source).toContain("destination.url");
    expect(source).toContain('target="_blank"');
  });

  it("inclui os principais visuais fixos que não pertencem ao catálogo", () => {
    const keys = new Set(SITE_VISUAL_ASSETS.map((asset) => asset.key));
    [
      "/site/logo.webp",
      "/site/trufado-de-ninho-home-20260803.png",
      "/site/beth-fundadora.png",
      "/site/clube-cartao-destaque-v2.webp",
      "/site/pede-junto-pacotes.webp",
      "/site/adoce-hoje-retirada-ilustracao.webp",
      "/site/adoce-hoje-barraquinha-ilustracao.webp",
      "/site/politica-de-pedidos.jpeg",
    ].forEach((key) => expect(keys.has(key), key).toBe(true));
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
