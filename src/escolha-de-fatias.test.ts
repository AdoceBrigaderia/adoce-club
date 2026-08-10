import { describe, expect, it } from "vitest";
import {
  SEM_CALDA,
  adicionar,
  avisoDeEstoque,
  dinheiro,
  escolherCalda,
  faltaEscolherCalda,
  oQueFalta,
  podeAdicionar,
  podeFinalizar,
  remover,
  restamDoSabor,
  resumoDoPedido,
  total,
  totalDeFatias,
  totalDePresentes,
  usarPresente,
  type Item,
  type Sabor,
} from "./escolha-de-fatias";

const chocolatudo: Sabor = { id: "c", nome: "Chocolatudo", preco: 16, disponiveis: 13, fotoUrl: null };
const pudim: Sabor = { id: "p", nome: "Torta de Pudim", preco: 25, disponiveis: 12, fotoUrl: null, premium: true };
const ferrero: Sabor = { id: "f", nome: "Ferrero Rocher", preco: 16, disponiveis: 3, fotoUrl: null };
const sabores = [chocolatudo, pudim, ferrero];

describe("a calda é obrigatória", () => {
  // "ele precisa escolher — só finaliza depois que ele escolhe"
  it("a fatia entra sem calda e o pedido não fecha", () => {
    const itens = adicionar([], chocolatudo);
    expect(faltaEscolherCalda(itens)).toBe(true);
    expect(podeFinalizar(itens)).toBe(false);
  });

  it("escolhida a calda, o pedido fecha", () => {
    let itens = adicionar([], chocolatudo);
    itens = escolherCalda(itens, "c", 0, "Chocolate");
    expect(podeFinalizar(itens)).toBe(true);
  });

  it("'sem calda' é uma escolha válida, não a ausência dela", () => {
    let itens = adicionar([], pudim);
    itens = escolherCalda(itens, "p", 0, SEM_CALDA);
    expect(podeFinalizar(itens)).toBe(true);
  });

  it("cada fatia tem a sua calda, mesmo sendo o mesmo sabor", () => {
    let itens = adicionar(adicionar([], chocolatudo), chocolatudo);
    itens = escolherCalda(itens, "c", 0, "Chocolate");
    expect(podeFinalizar(itens)).toBe(false);
    itens = escolherCalda(itens, "c", 1, "Ninho");
    expect(podeFinalizar(itens)).toBe(true);
  });

  it("diz o que falta, e some quando não falta mais", () => {
    let itens = adicionar(adicionar([], chocolatudo), pudim);
    expect(oQueFalta(itens)).toBe("Faltam escolher as caldas de 2 fatias.");
    itens = escolherCalda(itens, "c", 0, "Chocolate");
    expect(oQueFalta(itens)).toBe("Falta escolher a calda de uma fatia.");
    itens = escolherCalda(itens, "p", 0, SEM_CALDA);
    expect(oQueFalta(itens)).toBe("");
  });

  it("carrinho vazio não reclama de nada", () => {
    expect(oQueFalta([])).toBe("");
    expect(podeFinalizar([])).toBe(false);
  });
});

describe("estoque", () => {
  it("não deixa passar do disponível", () => {
    let itens: Item[] = [];
    for (let i = 0; i < 5; i += 1) itens = adicionar(itens, ferrero);
    expect(totalDeFatias(itens)).toBe(3);
    expect(podeAdicionar(itens, ferrero)).toBe(false);
  });

  it("conta quanto ainda resta", () => {
    const itens = adicionar([], ferrero);
    expect(restamDoSabor(itens, ferrero)).toBe(2);
  });

  it("remover devolve ao estoque", () => {
    let itens = adicionar(adicionar([], ferrero), ferrero);
    itens = remover(itens, "f");
    expect(restamDoSabor(itens, ferrero)).toBe(2);
  });

  it("remover a última tira o sabor do carrinho", () => {
    expect(remover(adicionar([], ferrero), "f")).toEqual([]);
  });
});

describe("aviso de estoque", () => {
  it("três ou menos vira motivo para escolher agora", () => {
    expect(avisoDeEstoque({ ...ferrero, disponiveis: 3 })).toBe("últimas 3");
    expect(avisoDeEstoque({ ...ferrero, disponiveis: 1 })).toBe("últimas 1");
  });

  it("com folga, só informa", () => {
    expect(avisoDeEstoque({ ...chocolatudo, disponiveis: 13 })).toBe("13 fatias");
  });

  it("esgotado é esgotado", () => {
    expect(avisoDeEstoque({ ...chocolatudo, disponiveis: 0 })).toBe("esgotado");
  });
});

describe("a fatia-presente é presente", () => {
  it("não é cobrada, e não vira desconto", () => {
    let itens = adicionar(adicionar([], chocolatudo), chocolatudo);
    itens = usarPresente(itens, "c", 1);
    expect(totalDePresentes(itens)).toBe(1);
    expect(total(itens, sabores)).toBe(16); // uma paga, uma é presente
  });

  it("o total nunca fica negativo", () => {
    let itens = adicionar([], chocolatudo);
    itens = usarPresente(itens, "c", 1);
    expect(total(itens, sabores)).toBe(0);
  });

  it("não usa mais presentes do que o cliente tem", () => {
    let itens = adicionar(adicionar([], chocolatudo), chocolatudo);
    itens = usarPresente(itens, "c", 1);
    itens = usarPresente(itens, "c", 1);
    expect(totalDePresentes(itens)).toBe(1);
  });

  it("não marca mais presentes do que fatias daquele sabor", () => {
    let itens = adicionar([], chocolatudo);
    itens = usarPresente(itens, "c", 5);
    itens = usarPresente(itens, "c", 5);
    expect(totalDePresentes(itens)).toBe(1);
  });

  it("o cliente escolhe onde usar — inclusive na fatia premium", () => {
    let itens = adicionar([], pudim);
    itens = usarPresente(itens, "p", 1);
    expect(total(itens, sabores)).toBe(0);
  });
});

describe("total", () => {
  it("soma o que é pago", () => {
    let itens = adicionar(adicionar([], chocolatudo), pudim);
    expect(total(itens, sabores)).toBe(41);
    expect(dinheiro(41)).toBe("R$ 41,00");
  });

  it("ignora sabor que não existe mais", () => {
    const itens: Item[] = [{ saborId: "sumiu", caldas: ["Chocolate"], presentes: 0 }];
    expect(total(itens, sabores)).toBe(0);
  });
});

describe("resumo para a operação", () => {
  it("agrupa as caldas e mostra o presente como presente", () => {
    let itens = adicionar(adicionar(adicionar([], chocolatudo), chocolatudo), pudim);
    itens = escolherCalda(itens, "c", 0, "Chocolate");
    itens = escolherCalda(itens, "c", 1, "Chocolate");
    itens = escolherCalda(itens, "p", 0, SEM_CALDA);
    itens = usarPresente(itens, "c", 1);

    const resumo = resumoDoPedido(itens, sabores);
    expect(resumo[0]).toEqual({
      sabor: "Chocolatudo", quantidade: 2, presentes: 1,
      caldas: [{ nome: "Chocolate", quantas: 2 }],
    });
    expect(resumo[1].caldas).toEqual([{ nome: SEM_CALDA, quantas: 1 }]);
  });

  it("fatia sem calda escolhida aparece como sem calda, não em branco", () => {
    const resumo = resumoDoPedido(adicionar([], chocolatudo), sabores);
    expect(resumo[0].caldas).toEqual([{ nome: SEM_CALDA, quantas: 1 }]);
  });
});
