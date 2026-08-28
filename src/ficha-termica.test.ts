import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePreferences } from "./RequestQuoteDocument";

const componente = readFileSync(new URL("./FichaTermica.tsx", import.meta.url), "utf8");
const estilo = readFileSync(new URL("./ficha-termica.css", import.meta.url), "utf8");

describe("o pedido da Gabriela cabe na ficha", () => {
  const preferencias = "100 docinhos ( 25 ninho, 25 brigadeiro, 25 beijinho e 25 nesquik)";

  it("vira quatro linhas com quantidade", () => {
    const itens = parsePreferences(preferencias);
    expect(itens).toHaveLength(4);
    expect(itens[0]).toEqual({ quantity: 25, description: "ninho" });
    expect(itens[3]).toEqual({ quantity: 25, description: "nesquik" });
  });

  it("o total sai da soma das linhas", () => {
    const total = parsePreferences(preferencias)
      .reduce((soma, item) => soma + (item.quantity || 0), 0);
    expect(total).toBe(100);
  });

  it("não quebra sabor que tem 'e' no nome", () => {
    const itens = parsePreferences("10 doce de leite e coco");
    expect(itens).toHaveLength(1);
  });
});

describe("regras da impressora térmica", () => {
  it("o papel é declarado com 58 mm", () => {
    expect(estilo).toContain("size: 58mm auto");
  });

  it("o conteúdo vive em 48 mm, porque a impressora come as bordas", () => {
    expect(estilo).toContain("--f-util: 48mm");
  });

  it("na impressão tudo vira preto puro — térmica não faz cinza", () => {
    expect(estilo).toContain("color: #000 !important");
    expect(estilo).toContain("background: transparent !important");
  });

  it("as divisórias são caractere, não borda fina", () => {
    expect(estilo).toContain('content: "---');
  });
});

describe("o que o Rubens pediu no desenho", () => {
  it("a logo é grande e vem no início", () => {
    expect(componente.indexOf("f-logo")).toBeLessThan(componente.indexOf("f-numero"));
    expect(estilo).toMatch(/\.f-logo\s*\{[^}]*width:\s*26mm/);
  });

  it("termina com uma mensagem bonita", () => {
    expect(componente).toContain("foi feito à mão");
    expect(componente).toContain("Obrigada por adoçar");
  });

  it("leva o convite para o Clube com QR", () => {
    expect(componente).toContain("Entre no Clube Adoce");
    expect(componente).toContain("#clube");
  });

  it("o QR não tem margem larga nem escala pequena, senão não lê no papel", () => {
    expect(componente).toContain("margin: 0");
    expect(componente).toContain("scale: 6");
  });
});
