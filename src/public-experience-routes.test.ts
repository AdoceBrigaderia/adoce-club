import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pathFromLegacyHash } from "./route-paths";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const mobileNav = readFileSync(new URL("./PublicMobileNav.tsx", import.meta.url), "utf8");
const accessApp = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const cakeCatalog = readFileSync(new URL("./CakeCatalogPage.tsx", import.meta.url), "utf8");
const sweetsCatalog = readFileSync(new URL("./CommercialCatalog.tsx", import.meta.url), "utf8");
const marketingCatalog = readFileSync(new URL("./CatalogPage2026.tsx", import.meta.url), "utf8");

describe("arquitetura pública por intenção", () => {
  it.each([
    ["#cardapio", "/cardapio"],
    ["#sabores", "/sabores"],
    ["#catalogo", "/catalogo"],
    ["#clube/cadastro", "/clube/cadastro"],
  ])("normaliza a rota legada %s", (hash, path) => {
    expect(pathFromLegacyHash(hash)).toBe(path);
  });

  it("mantém aliases antigos e separa cardápio dos sabores de tortas", () => {
    expect(app).toContain('routeHash.startsWith("#cardapio")');
    expect(app).toContain('routeHash.startsWith("#adoce-hoje")');
    expect(app).toContain('routeHash.startsWith("#sabores")');
    expect(app).toMatch(/#sabores[\s\S]{0,180}<CakeCatalogPage\/>/);
  });

  it("leva /cardapio à antiga página principal com calendário semanal", () => {
    expect(app).toContain('<AdoceHomeCatalog/>');
    expect(app).toMatch(/#cardapio[\s\S]{0,180}<AdoceHomeCatalog\/>/);
  });

  it("separa os sabores de tortas e as fotos de docinhos sem abas repetidas", () => {
    expect(cakeCatalog).not.toContain("PublicCatalogNav");
    expect(cakeCatalog).not.toContain("Tamanhos e valores");
    expect(cakeCatalog).toContain("Sabores disponíveis para tortas");
    expect(sweetsCatalog).not.toContain("PublicCatalogNav");
    expect(marketingCatalog).toContain('href="/sabores"');
    expect(marketingCatalog).toContain('href="/docinhos"');
    expect(marketingCatalog).toContain("Clique aqui para ver algumas fotos de docinhos");
  });

  it("usa /cardapio como destino canônico da navegação", () => {
    expect(mobileNav).toContain('href: "/cardapio"');
  });

  it("encaminha /clube/cadastro para o fluxo de criação do cartão", () => {
    expect(app).toContain('routeHash.startsWith("#clube/cadastro")');
    expect(app.indexOf('routeHash.startsWith("#clube/cadastro")')).toBeLessThan(app.indexOf('routeHash.startsWith("#clube")'));
  });

  it("usa o fluxo real de autenticação e conta na rota principal do Clube", () => {
    expect(app).toMatch(/#clube"\)\)return <CustomerSurface minimal><AccessApp surface="client"\/><\/CustomerSurface>/);
    expect(accessApp).toMatch(/currentRouteHash\(\)\.startsWith\("#clube"\) \? "profile" :/);
    expect(accessApp).toContain('currentRouteHash().startsWith("#clube")');
    expect(accessApp).toMatch(/registrationRoute[\s\S]{0,180}startsWith\("#clube"\)/);
  });

  it("identifica visualmente o cardápio para aplicar o mockup aprovado", () => {
    expect(app).toContain('public-app-shell-${active || "none"}');
  });
});
