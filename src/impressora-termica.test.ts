import { describe, expect, it } from "vitest";
import {
  COLUNAS,
  COMANDOS,
  centralizar,
  doisLados,
  fatiar,
  linhaTracejada,
  montarBytes,
  montarTexto,
  quando,
  paraBytes,
  quebrarLinha,
  type Ficha,
} from "./lib/impressora-termica";

function ficha(o: Partial<Ficha> = {}): Ficha {
  return {
    numero: "FAT-20260810-0031",
    cliente: "Annaliza Damasceno",
    telefone: "(85) 99272-2285",
    itens: [
      { sabor: "Trufado de Ninho", quantidade: 2, calda: "Calda de chocolate", presente: false },
      { sabor: "Torta de Pudim", quantidade: 1, calda: null, presente: true },
    ],
    total: 57,
    retirada: "Cantinho da Adoce · a partir das 18h",
    observacao: null,
    criadoEm: "2026-08-10T21:00:00Z",
    ...o,
  };
}

describe("a largura do papel", () => {
  // Knup 1025: 58 mm de papel, 48 mm de área útil = 32 colunas.
  it("são 32 colunas", () => {
    expect(COLUNAS).toBe(32);
    expect(linhaTracejada()).toHaveLength(32);
  });

  it("nenhuma linha da ficha passa da largura", () => {
    for (const linha of montarTexto(ficha())) {
      expect(linha.length).toBeLessThanOrEqual(COLUNAS);
    }
  });

  it("nome comprido é quebrado por palavra, não cortado", () => {
    const linhas = quebrarLinha("Maria das Graças Nascimento Albuquerque Silva");
    expect(linhas.every((l) => l.length <= COLUNAS)).toBe(true);
    expect(linhas.join(" ")).toContain("Albuquerque");
  });

  it("palavra única gigante é partida em vez de sumir", () => {
    const linhas = quebrarLinha("A".repeat(70));
    expect(linhas).toHaveLength(3);
    expect(linhas.every((l) => l.length <= COLUNAS)).toBe(true);
  });

  it("centraliza sem estourar", () => {
    expect(centralizar("ADOCE").length).toBeLessThanOrEqual(COLUNAS);
    expect(centralizar("A".repeat(50)).length).toBe(COLUNAS);
  });

  it("valor à direita, nome à esquerda, na mesma linha", () => {
    const linha = doisLados("3 FATIAS", "R$ 57,00");
    expect(linha).toHaveLength(COLUNAS);
    expect(linha.startsWith("3 FATIAS")).toBe(true);
    expect(linha.endsWith("R$ 57,00")).toBe(true);
  });

  it("nome longo demais cede espaço ao valor", () => {
    const linha = doisLados("Nome absurdamente comprido de item", "R$ 16,00");
    expect(linha).toHaveLength(COLUNAS);
    expect(linha.endsWith("R$ 16,00")).toBe(true);
  });
});

describe("acentuação", () => {
  // Sem página de código, "Ração" sai "RaÃ§Ã£o" no papel.
  it("usa CP860 para os acentos do português", () => {
    expect(paraBytes("ç")).toEqual([0x87]);
    expect(paraBytes("ã")).toEqual([0x84]);
    expect(paraBytes("é")).toEqual([0x82]);
    expect(paraBytes("õ")).toEqual([0x94]);
  });

  it("letra sem acento passa direto", () => {
    expect(paraBytes("Adoce")).toEqual([65, 100, 111, 99, 101]);
  });

  it("fora da tabela, cai para a versão sem acento — nunca um quadrado preto", () => {
    // "ẽ" não existe em CP860; vira "e".
    expect(paraBytes("ẽ")).toEqual([101]);
  });

  it("o comando da página de código vai no começo de toda ficha", () => {
    const bytes = Array.from(montarBytes(ficha()));
    const inicio = bytes.slice(0, 5);
    expect(inicio.slice(0, 2)).toEqual([...COMANDOS.iniciar]);
    expect(inicio.slice(2, 5)).toEqual([...COMANDOS.paginaCodigoPortugues]);
  });
});

describe("o conteúdo da ficha", () => {
  const linhas = montarTexto(ficha());
  const texto = linhas.join("\n");

  it("traz o número do pedido, que é o que a operação procura", () => {
    expect(texto).toContain("FAT-20260810-0031");
  });

  it("traz cliente, telefone e os sabores com calda", () => {
    expect(texto).toContain("Annaliza Damasceno");
    expect(texto).toContain("(85) 99272-2285");
    expect(texto).toContain("2x Trufado de Ninho");
    expect(texto).toContain("Calda de chocolate");
  });

  it("fatia sem calda diz 'Sem calda', não fica em branco", () => {
    expect(texto).toContain("Sem calda");
  });

  it("o presente aparece como presente", () => {
    expect(texto).toContain("PRESENTE DO CLUBE");
  });

  it("soma as fatias e mostra o total", () => {
    expect(texto).toContain("3 FATIAS");
    expect(texto).toContain("R$ 57,00");
  });

  it("traz o local e a hora da retirada", () => {
    expect(texto).toContain("Cantinho da Adoce");
    expect(texto).toContain("18h");
  });

  it("fecha com a mensagem da casa", () => {
    expect(texto).toContain("Feito pelas maos da Beth");
  });

  it("observação só aparece quando existe", () => {
    expect(montarTexto(ficha()).join("\n")).not.toContain("OBSERVACAO");
    expect(montarTexto(ficha({ observacao: "Sem açúcar" })).join("\n")).toContain("OBSERVACAO");
  });
});

describe("envio para o aparelho", () => {
  it("termina cortando o papel", () => {
    const bytes = Array.from(montarBytes(ficha()));
    expect(bytes.slice(-4)).toEqual([...COMANDOS.cortar]);
  });

  it("vai em pedaços pequenos — pacote grande chega truncado", () => {
    const bytes = montarBytes(ficha());
    const pedacos = fatiar(bytes);
    expect(pedacos.every((p) => p.length <= 180)).toBe(true);
    expect(pedacos.reduce((s, p) => s + p.length, 0)).toBe(bytes.length);
  });

  it("ficha pequena vai num pedaço só", () => {
    expect(fatiar(new Uint8Array(50))).toHaveLength(1);
  });
});

describe("as três datas não podem se confundir", () => {
  // O Rubens viu a ficha e leu a hora da impressão como se fosse a do pedido.
  // Elas ficam longe uma da outra, e a de baixo sempre com rótulo.
  const ficha: Ficha = {
    numero: "ADO-2026-000012",
    cliente: "Josefa Maria",
    telefone: "(85) 98215-6026",
    itens: [{ sabor: "Brigadeiro", quantidade: 25, calda: null, presente: false }],
    total: 50,
    retirada: "15/08/2026 as 01h30",
    observacao: null,
    criadoEm: "2026-08-11T17:00:00-03:00",
    impressoEm: "2026-08-12T02:17:00-03:00",
  };

  it("a data do pedido vem logo abaixo do número", () => {
    const linhas = montarTexto(ficha);
    const iNumero = linhas.findIndex((l) => l.includes("ADO-2026-000012"));
    expect(linhas[iNumero + 1]).toContain("Pedido em 11/08/2026");
  });

  it("mostra a hora em que o cliente pediu, não só o dia", () => {
    expect(montarTexto(ficha).join("\n")).toContain("11/08/2026 as 17h00");
  });

  it("a hora da impressão fica no fim e sempre com rótulo", () => {
    const linhas = montarTexto(ficha);
    const impressa = linhas.findIndex((l) => l.includes("impresso"));
    const pedido = linhas.findIndex((l) => l.includes("Pedido em"));
    expect(impressa).toBeGreaterThan(pedido + 5);
    expect(linhas[impressa]).toContain("12/08/2026 as 02h17");
  });

  it("sem impressoEm, usa a hora de agora — e nunca a do pedido", () => {
    const { impressoEm: _, ...sem } = ficha;
    const texto = montarTexto(sem).join("\n");
    expect(texto).toContain("Pedido em 11/08/2026 as 17h00");
    expect(texto).not.toContain("impresso 11/08/2026 as 17h00");
  });

  it("data inválida não imprime lixo", () => {
    expect(quando("nao e data")).toBe("");
  });
});
