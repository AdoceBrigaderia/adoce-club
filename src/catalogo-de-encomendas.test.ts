import { describe, expect, it } from "vitest";
import {
  SEGMENTOS,
  dinheiro,
  menorPrecoDoSegmento,
  mensagemDeInteresse,
  prazoPorExtenso,
  precisaDeFoto,
  precoPorExtenso,
  produtosDoSegmento,
  segmentoDaRota,
  segmentosComProduto,
  tituloDoSegmento,
  type Produto,
} from "./catalogo-de-encomendas";

function produto(o: Partial<Produto> = {}): Produto {
  return {
    id: "p", segmento: "cakes", nome: "Torta P", resumo: "De 10 a 15 fatias.",
    preco: 115, sufixo: "", minimo: 1, prazoDiasUteis: 3,
    fotoUrl: null, publicado: true, ordem: 1, ...o,
  };
}

// Dados reais do banco de produção, conferidos em 10/08/2026.
const catalogo: Produto[] = [
  produto({ id: "tp", nome: "Torta P", preco: 115, ordem: 1 }),
  produto({ id: "tm", nome: "Torta M", preco: 155, ordem: 2, resumo: "De 20 a 25 fatias." }),
  produto({ id: "tg", nome: "Torta G", preco: 195, ordem: 3, resumo: "De 30 a 35 fatias." }),
  produto({ id: "dt", segmento: "sweets", nome: "Docinhos tradicionais", preco: 35, sufixo: "a partir de", minimo: 25, prazoDiasUteis: 1, fotoUrl: "/f.webp" }),
  produto({ id: "de", segmento: "sweets", nome: "Docinhos especiais", preco: 45, sufixo: "a partir de", minimo: 25, prazoDiasUteis: 1, fotoUrl: "/f.webp" }),
];

describe("os segmentos ativos do catálogo", () => {
  it("mostra somente tortas e docinhos", () => {
    const chaves = SEGMENTOS.map((s) => s.chave);
    expect(chaves).toEqual(["cakes", "sweets"]);
  });

  it("cada segmento tem rota própria, para trocar sem voltar à home", () => {
    // "a página de tortas deve ter acesso direto aos docinhos"
    for (const s of SEGMENTOS) {
      expect(s.rota.startsWith("/encomendas/")).toBe(true);
      expect(segmentoDaRota(s.rota)).toBe(s.chave);
    }
  });

  it("rota desconhecida não escolhe segmento por engano", () => {
    expect(segmentoDaRota("/clube")).toBeNull();
  });

  it("os nomes são os que o cliente entende", () => {
    expect(tituloDoSegmento("cakes")).toBe("Tortas");
    expect(tituloDoSegmento("sweets")).toBe("Docinhos");
  });
});

describe("preço", () => {
  it("sem centavos quando é valor redondo", () => {
    expect(dinheiro(115)).toBe("R$ 115");
    expect(dinheiro(35.5)).toBe("R$ 35,50");
  });

  it("torta sai com o preço direto", () => {
    expect(precoPorExtenso(produto({ preco: 195 }))).toBe("R$ 195");
  });

  it("docinho sai como 'a partir de'", () => {
    expect(precoPorExtenso(produto({ preco: 35, sufixo: "a partir de" }))).toBe("a partir de R$ 35");
  });

});

describe("prazo", () => {
  it("três dias úteis para torta", () => {
    expect(prazoPorExtenso(produto({ prazoDiasUteis: 3 }))).toBe("3 dias úteis de antecedência");
  });

  it("um dia fala no singular", () => {
    expect(prazoPorExtenso(produto({ prazoDiasUteis: 1 }))).toBe("1 dia útil de antecedência");
  });
});

describe("foto", () => {
  it("aponta quem está sem foto — 12 dos 15 produtos hoje", () => {
    expect(precisaDeFoto(produto({ fotoUrl: null }))).toBe(true);
    expect(precisaDeFoto(produto({ fotoUrl: "/f.webp" }))).toBe(false);
  });

  it("produto sem foto continua na lista", () => {
    // Esconder seria pior: o cliente deixa de saber que existe.
    expect(produtosDoSegmento(catalogo, "cakes")).toHaveLength(3);
  });
});

describe("listagem", () => {
  it("ordena pela ordem definida e depois pelo preço", () => {
    expect(produtosDoSegmento(catalogo, "cakes").map((p) => p.nome))
      .toEqual(["Torta P", "Torta M", "Torta G"]);
  });

  it("não publicado fica de fora", () => {
    const lista = [...catalogo, produto({ id: "x", nome: "Rascunho", publicado: false })];
    expect(produtosDoSegmento(lista, "cakes").map((p) => p.nome)).not.toContain("Rascunho");
  });

  it("mostra a partir de quanto sai cada segmento", () => {
    expect(menorPrecoDoSegmento(catalogo, "cakes")).toBe(115);
    expect(menorPrecoDoSegmento(catalogo, "sweets")).toBe(35);
  });

  it("segmento sem produto não aparece", () => {
    const so = [produto({ id: "a" })];
    expect(segmentosComProduto(so).map((s) => s.chave)).toEqual(["cakes"]);
  });

  it("com produtos antigos no banco, só aparecem as linhas ativas", () => {
    expect(segmentosComProduto(catalogo).map((segmento) => segmento.chave)).toEqual(["cakes", "sweets"]);
  });
});

describe("mensagem de interesse", () => {
  it("cita o produto, o mínimo e o preço", () => {
    const texto = mensagemDeInteresse(catalogo.find((p) => p.id === "dt")!);
    expect(texto).toContain("Docinhos tradicionais");
    expect(texto).toContain("Mínimo de 25");
    expect(texto).toContain("a partir de R$ 35");
  });

  it("não manda link — cliente sem dado móvel não abre", () => {
    expect(mensagemDeInteresse(produto())).not.toContain("http");
  });

  it("omite o mínimo quando é uma unidade", () => {
    expect(mensagemDeInteresse(produto({ minimo: 1 }))).not.toContain("Mínimo");
  });
});
