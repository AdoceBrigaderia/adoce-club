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
        expect(destination.url).toMatch(/^https:\/\/www\.cantinhodaadoce\.com\.br\/(?:[-a-z]+(?:\/[-a-z]+)?)?$/);
      });
    });
  });

  it("mostra na central a URL clicável de cada página que usa a imagem", () => {
    const source = readFileSync(new URL("./OperationVisualSettings.tsx", import.meta.url), "utf8");
    expect(source).toContain("SITE_VISUAL_PAGE_LINKS[definition.key].map");
    expect(source).toContain("destination.url");
    expect(source).toContain('target="_blank"');
  });

  it("só inclui fotos confirmadas ao vivo num lugar de verdade (site público ou documento impresso)", () => {
    // Segunda revisão, 03/11/2026: a primeira passada ainda tinha confiado
    // demais em grep de código. Esta usa evidência de DOM ao vivo em
    // produção (ou prova equivalente de que a classe/elemento que usaria a
    // imagem não existe em nenhum componente). Terceira correção, mesma
    // data: logo.webp voltou -- não controla o cabeçalho do site, mas é a
    // logo real do recibo térmico e do PDF de orçamento; removê-la tirava
    // do proprietário a única forma de trocar essa logo impressa. A
    // descrição foi corrigida para dizer isso com precisão, em vez de
    // prometer controle do site.
    const keys = new Set(SITE_VISUAL_ASSETS.map((asset) => asset.key));
    [
      "/site/logo.webp",
      "/site/clube-convite-pedido.webp",
      "/site/adoce-hoje-retirada-ilustracao.webp",
      "/site/adoce-hoje-barraquinha-ilustracao.webp",
    ].forEach((key) => expect(keys.has(key), key).toBe(true));
    expect(keys.size).toBe(4);
    // Removidas na primeira passada em 03/11/2026 (Página inicial, Pede
    // Junto Adoce, Política de pedidos) -- continuam fora.
    // Removidas na segunda passada, mesma data, por terem função zero em
    // qualquer lugar (confirmado ao vivo, não só por grep):
    // - hero-cake.webp: a classe CSS que o usaria (.access-auth-copy) não
    //   existe em nenhum componente -- confirmado que o elemento não existe
    //   no DOM de /entrar em produção.
    // - sabores-hoje.webp: só aparece quando um sabor ativo não tem foto
    //   própria; hoje nenhum sabor ativo está nessa situação.
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
      "/site/hero-cake.webp",
      "/adoce-hoje/sabores-hoje.webp",
    ].forEach((key) => expect(keys.has(key), key).toBe(false));
  });

  it("descreve a logo com precisão: impressos, não cabeçalho do site", () => {
    const header = readFileSync(new URL("./PublicHeader.tsx", import.meta.url), "utf8");
    const topBar = readFileSync(new URL("./PublicTopBar.tsx", import.meta.url), "utf8");
    expect(header).toContain("/brand-2026/logo-adoce-transparente.png");
    expect(topBar).toContain("/brand-2026/logo-cantinho-adoce.png");
    expect(header).not.toContain("/site/logo.webp");
    expect(topBar).not.toContain("/site/logo.webp");
    const ficha = readFileSync(new URL("./FichaTermica.tsx", import.meta.url), "utf8");
    const quote = readFileSync(new URL("./RequestQuoteDocument.tsx", import.meta.url), "utf8");
    expect(ficha).toContain("/site/logo.webp");
    expect(quote).toContain("/site/logo.webp");
    const logo = SITE_VISUAL_ASSETS.find((asset) => asset.key === "/site/logo.webp");
    expect(logo?.description).toContain("recibo térmico");
    expect(logo?.description).not.toContain("Cabeçalhos, rodapés, operação e compartilhamentos");
  });

  it("confirma que .access-auth-copy (hero-cake.webp) não existe em nenhum componente", () => {
    const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
    expect(access).not.toContain("access-auth-copy");
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
