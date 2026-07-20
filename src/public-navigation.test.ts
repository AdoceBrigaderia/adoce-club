import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const header = readFileSync(new URL("./PublicHeader.tsx", import.meta.url), "utf8");
const landing = readFileSync(new URL("./MarketingLanding.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const orderPolicy = readFileSync(new URL("./OrderPolicyPage.tsx", import.meta.url), "utf8");
const operationCss = readFileSync(new URL("./access-app.css", import.meta.url), "utf8");
const accessFunction = readFileSync(new URL("../netlify/functions/staff-access-code.ts", import.meta.url), "utf8");

const destinations = [
  "#adoce-hoje",
  "#encomendas",
  "#eventos",
  "#adoce-na-escola",
  "#compra-em-grupo",
  "#clube",
  "#entrar",
];

describe("navegação pública por operação", () => {
  it("oferece destinos comerciais diferentes no cabeçalho e na home", () => {
    for (const destination of destinations) {
      expect(`${header}\n${landing}`).toContain(destination);
      expect(app).toContain(`startsWith(\"${destination}\")`);
    }
  });

  it("identifica a marca geral como Adoce Brigaderia", () => {
    expect(header).toContain("Adoce Brigaderia");
    expect(header).not.toContain("<strong>Clube Adoce</strong>");
  });

  it("publica a política de pedidos com regras legíveis e acesso pela home", () => {
    expect(landing).toContain("/#politica-de-pedidos");
    expect(app).toContain('startsWith("#politica-de-pedidos")');
    expect(orderPolicy).toContain("Segunda a quarta-feira");
    expect(orderPolicy).toContain("Quinta a sábado");
    expect(orderPolicy).toContain("Domingos");
    expect(orderPolicy).toContain("/site/politica-de-pedidos.jpeg");
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
