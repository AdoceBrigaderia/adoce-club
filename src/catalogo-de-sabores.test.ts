import { describe, expect, it } from "vitest";
import {
  contar,
  dinheiro,
  frasedoEstado,
  linkDeWhatsApp,
  listaDeIngredientes,
  nomeDoDia,
  ordenar,
  pedidoDeTortaInteira,
  perguntaSobreOSabor,
  podeReservarAgora,
  type SaborNaVitrine,
} from "./catalogo-de-sabores";

function sabor(nome: string, o: Partial<SaborNaVitrine> = {}): SaborNaVitrine {
  return {
    id: nome, nome,
    resumo: "Chocolate com brigadeiro de Ninho e morango. O mais elogiado da casa.",
    descricao: "Massa de chocolate com recheio de ninho e morangos.",
    ingredientes: "leite ninho, morango, chocolate, ovos",
    preco: 16, fotoFatia: "/f.webp", fotoTorta: null,
    tortaInteira: false, precoTorta: null, categoria: "tradicional",
    estado: "ausente", disponiveis: 0, proximaData: null, proximoDia: null,
    ...o,
  };
}

describe("a vitrine não depende do estoque", () => {
  // "do jeito que tá, o cliente só consegue ver as tortas se existir estoque,
  //  daí não tem como gerar a vontade nele"
  it("sabor sem estoque continua na lista", () => {
    const lista = [sabor("Surpresa de Uva", { estado: "ausente" })];
    expect(ordenar(lista)).toHaveLength(1);
  });

  it("todo sabor tem alguma frase — nenhum fica mudo", () => {
    const estados: SaborNaVitrine[] = [
      sabor("A", { estado: "hoje", disponiveis: 8 }),
      sabor("B", { estado: "hoje", disponiveis: 2 }),
      sabor("C", { estado: "hoje", disponiveis: 0 }),
      sabor("D", { estado: "previsto", proximoDia: "quinta" }),
      sabor("E", { estado: "ausente" }),
    ];
    for (const s of estados) expect(frasedoEstado(s).length).toBeGreaterThan(8);
  });

  it("esgotado nunca vem seco — sempre oferece caminho", () => {
    expect(frasedoEstado(sabor("x", { estado: "hoje", disponiveis: 0 })))
      .toContain("avisamos quando voltar");
    expect(frasedoEstado(sabor("x", { estado: "ausente" }))).toContain("Avisamos");
  });

  it("o que tem hoje diz quanto tem", () => {
    expect(frasedoEstado(sabor("x", { estado: "hoje", disponiveis: 8 }))).toBe("8 fatias hoje");
    expect(frasedoEstado(sabor("x", { estado: "hoje", disponiveis: 2 }))).toBe("Últimas 2 de hoje");
  });

  it("o previsto diz o dia — é o que o cardápio fixo vai alimentar", () => {
    expect(frasedoEstado(sabor("x", { estado: "previsto", proximoDia: "quinta" }))).toBe("Sai quinta");
  });
});

describe("só reserva o que existe agora", () => {
  it("com fatia hoje, reserva", () => {
    expect(podeReservarAgora(sabor("x", { estado: "hoje", disponiveis: 3 }))).toBe(true);
  });

  it("acabou hoje, previsto ou ausente não reserva", () => {
    expect(podeReservarAgora(sabor("x", { estado: "hoje", disponiveis: 0 }))).toBe(false);
    expect(podeReservarAgora(sabor("x", { estado: "previsto" }))).toBe(false);
    expect(podeReservarAgora(sabor("x", { estado: "ausente" }))).toBe(false);
  });
});

describe("ordem da vitrine", () => {
  it("primeiro o que dá para levar hoje, depois o previsto, e o resto no fim", () => {
    const lista = [
      sabor("Ausente", { estado: "ausente" }),
      sabor("Acabou", { estado: "hoje", disponiveis: 0 }),
      sabor("Previsto", { estado: "previsto", proximoDia: "quinta" }),
      sabor("Tem hoje", { estado: "hoje", disponiveis: 5 }),
    ];
    expect(ordenar(lista).map((s) => s.nome))
      .toEqual(["Tem hoje", "Previsto", "Acabou", "Ausente"]);
  });

  it("empate resolve por nome, respeitando acento", () => {
    const lista = [sabor("Ouro Branco", { estado: "ausente" }), sabor("Abacaxi", { estado: "ausente" })];
    expect(ordenar(lista)[0].nome).toBe("Abacaxi");
  });
});

describe("contagem para o topo da tela", () => {
  it("separa o total, o de hoje e o previsto", () => {
    const lista = [
      sabor("A", { estado: "hoje", disponiveis: 5 }),
      sabor("B", { estado: "hoje", disponiveis: 0 }),
      sabor("C", { estado: "previsto", proximoDia: "sexta" }),
      sabor("D", { estado: "ausente" }),
    ];
    expect(contar(lista)).toEqual({ total: 4, hoje: 1, previstos: 1 });
  });
});

describe("perguntar sobre o sabor", () => {
  it("a pergunta é específica — quem recebe sabe responder", () => {
    const texto = perguntaSobreOSabor(sabor("Surpresa de Uva"));
    expect(texto).toContain("Surpresa de Uva");
    expect(texto).toContain("de novo");
    expect(texto.length).toBeLessThan(80);
  });

  it("dá para encomendar a torta inteira do sabor", () => {
    expect(pedidoDeTortaInteira(sabor("Ferrero Rocher"))).toContain("torta inteira de Ferrero Rocher");
  });

  it("o link leva a mensagem pronta para o WhatsApp da Adoce", () => {
    const url = linkDeWhatsApp(perguntaSobreOSabor(sabor("Oreo")));
    expect(url).toContain("wa.me/5585982156026");
    expect(decodeURIComponent(url)).toContain("Oreo");
  });
});

describe("o resumo de vitrine", () => {
  // "preferia que criasse mais uma tabela no banco e colocasse um resumo
  //  bem legal pra cada um dos sabores e usasse esse resumo nessa tela"
  it("é curto — cabe embaixo da foto sem virar parágrafo", () => {
    expect(sabor("x").resumo.length).toBeLessThanOrEqual(90);
  });

  it("não é a descrição técnica", () => {
    const s = sabor("x");
    expect(s.resumo).not.toBe(s.descricao);
    expect(s.resumo.toLowerCase()).not.toContain("três camadas");
    expect(s.resumo.toLowerCase()).not.toContain("aerada");
  });
});

describe("detalhes do sabor", () => {
  it("ingredientes viram lista — fora da vitrine, para a ficha técnica", () => {
    expect(listaDeIngredientes(sabor("x"))).toEqual(["leite ninho", "morango", "chocolate", "ovos"]);
  });

  it("aceita ponto e vírgula e espaços sobrando", () => {
    expect(listaDeIngredientes(sabor("x", { ingredientes: " ovo ;  leite , " })))
      .toEqual(["ovo", "leite"]);
  });

  it("preço sai sem o espaço invisível do formatador", () => {
    expect(dinheiro(16)).toBe("R$ 16,00");
  });

  it("sabe o nome do dia", () => {
    expect(nomeDoDia(new Date("2026-08-13T12:00:00Z"))).toBe("quinta");
  });
});
