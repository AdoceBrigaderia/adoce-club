import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const header = readFileSync(new URL("./PublicHeader.tsx", import.meta.url), "utf8");
const landing = readFileSync(new URL("./MarketingLanding.tsx", import.meta.url), "utf8");
const mobileNav = readFileSync(new URL("./PublicMobileNav.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const orderPolicy = readFileSync(new URL("./OrderPolicyPage.tsx", import.meta.url), "utf8");
const operationCss = readFileSync(new URL("./access-app.css", import.meta.url), "utf8");
const accessFunction = readFileSync(new URL("../netlify/functions/staff-access-code.ts", import.meta.url), "utf8");

describe("navegação pública Mobile First", () => {
  it("mantém os quatro destinos aprovados no rodapé fixo", () => {
    for (const label of ["Início", "Cardápio", "Pedidos", "Conta"]) {
      expect(mobileNav).toContain(label);
    }
    for (const destination of ["#inicio", "#adoce-hoje", "#carrinho", "#minha-conta"]) {
      expect(mobileNav).toContain(destination);
      if (destination !== "#inicio") expect(app).toContain(destination);
    }
    expect(mobileNav).toContain("public-shell-nav");
    expect(app).toContain("<PublicHeader />");
  });

  it("identifica a marca geral como Adoce Brigaderia", () => {
    expect(header).toContain("Adoce Brigaderia");
    expect(header).not.toContain("<strong>Clube Adoce</strong>");
    expect(header).toContain('firstName = member?.firstName || "Cliente"');
    expect(header).toContain('progress = member?.progress || 0');
  });

  it("mantém a política de pedidos em uma página dedicada", () => {
    expect(app).toContain('startsWith("#politica-de-pedidos")');
    expect(orderPolicy).toContain("Segunda a quarta-feira");
    expect(orderPolicy).toContain("Quinta a sábado");
    expect(orderPolicy).toContain("Domingos");
    expect(orderPolicy).toContain("/site/politica-de-pedidos.jpeg");
  });

  it("leva os produtos reais e a ação principal para o início da experiência", () => {
    expect(landing).toContain('className="home-reference-card slices" href="/#adoce-hoje"');
    expect(landing).toContain('className="home-reference-card cakes" href="/#encomendas"');
    expect(landing).toContain("/adoce-hoje/chocolatudo.webp");
    expect(landing).toContain("Fazer meu pedido");
    expect(landing).toContain("Ver fatias disponíveis");
  });
});

describe("operação móvel", () => {
  it("mantém a navegação em uma linha rolável e limita a viewport", () => {
    expect(operationCss).toContain("flex-wrap: nowrap");
    expect(operationCss).toContain("overflow-x: auto");
    expect(operationCss).toContain("max-width: 100vw");
    expect(operationCss).toContain("text-size-adjust: 100%");
  });
});

describe("acesso direto assistido", () => {
  it("gera URL do próprio site para a tela que valida o código", () => {
    expect(accessFunction).toContain("#acesso-direto?");
    expect(accessFunction).toContain("directParams.toString()");
    expect(app).toContain("#acesso-direto");
  });
});
