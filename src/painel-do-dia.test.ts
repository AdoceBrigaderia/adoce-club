import { describe, expect, it } from "vitest";
import {
  aLiberar,
  acoesDoDia,
  disponivel,
  frasedoDia,
  resumoDoDia,
  saboresOrdenados,
  type EstadoDoDia,
  type PedidoDoDia,
  type SaborDoDia,
} from "./painel-do-dia";

function sabor(nome: string, overrides: Partial<SaborDoDia> = {}): SaborDoDia {
  return {
    flavorId: nome,
    nome,
    planejado: 13,
    liberado: 13,
    vendido: 0,
    preco: 16,
    ...overrides,
  };
}

function pedido(overrides: Partial<PedidoDoDia> = {}): PedidoDoDia {
  return {
    id: "p1",
    numero: "FAT-0001",
    cliente: "Juliana Sousa",
    fatias: 2,
    total: 32,
    criadoEm: new Date().toISOString(),
    retiradaEm: null,
    status: "novo",
    ...overrides,
  };
}

function dia(overrides: Partial<EstadoDoDia> = {}): EstadoDoDia {
  return {
    data: "2026-08-08",
    lojaAberta: true,
    sabores: [sabor("Chocolatudo")],
    pedidos: [],
    avisosPendentes: 0,
    ...overrides,
  };
}

const chaves = (estado: EstadoDoDia) => acoesDoDia(estado).map((a) => a.chave);

describe("contagem de fatias", () => {
  it("disponÃ­vel Ã© o que foi liberado menos o que saiu", () => {
    expect(disponivel(sabor("x", { liberado: 13, vendido: 5 }))).toBe(8);
  });

  it("nunca fica negativo, mesmo com dado torto", () => {
    expect(disponivel(sabor("x", { liberado: 3, vendido: 10 }))).toBe(0);
    expect(aLiberar(sabor("x", { planejado: 2, liberado: 10 }))).toBe(0);
  });

  it("a liberar Ã© o planejado que ainda nÃ£o virou estoque", () => {
    expect(aLiberar(sabor("x", { planejado: 13, liberado: 0 }))).toBe(13);
  });
});

describe("o bug dos 11 dias", () => {
  // Em 28/07 havia 78 fatias planejadas e o site mostrava esgotado.
  // O painel precisa gritar exatamente nesse cenÃ¡rio.
  const esgotadoComEstoque = dia({
    sabores: [
      sabor("Chocolatudo", { planejado: 13, liberado: 0 }),
      sabor("Black Velvet", { planejado: 13, liberado: 0 }),
    ],
  });

  it("aponta a produÃ§Ã£o nÃ£o liberada como crÃ­tico", () => {
    const acao = acoesDoDia(esgotadoComEstoque).find((a) => a.chave === "liberar-producao");
    expect(acao?.gravidade).toBe("critico");
    expect(acao?.titulo).toContain("26");
    expect(acao?.botao).toBe("Liberar produÃ§Ã£o");
  });

  it("diz na frase do dia que o site estÃ¡ mostrando esgotado", () => {
    expect(frasedoDia(esgotadoComEstoque)).toContain("Esgotado no site");
  });

  it("nÃ£o trata como dia vazio, porque produÃ§Ã£o existe", () => {
    expect(chaves(esgotadoComEstoque)).not.toContain("dia-vazio");
  });
});

describe("pedidos sem resposta", () => {
  it("vem em primeiro lugar, acima de tudo", () => {
    const estado = dia({
      pedidos: [pedido()],
      sabores: [sabor("x", { planejado: 13, liberado: 0 })],
      avisosPendentes: 3,
    });
    expect(chaves(estado)[0]).toBe("pedidos-novos");
  });

  it("cita o cliente quando Ã© um sÃ³", () => {
    const acao = acoesDoDia(dia({ pedidos: [pedido()] }))[0];
    expect(acao.detalhe).toContain("Juliana Sousa");
    expect(acao.detalhe).toContain("2 fatias");
  });

  it("pedido cancelado nÃ£o pede aÃ§Ã£o nem entra na receita", () => {
    const estado = dia({ pedidos: [pedido({ status: "cancelado" })] });
    expect(chaves(estado)).not.toContain("pedidos-novos");
    expect(resumoDoDia(estado).receita).toBe(0);
    expect(resumoDoDia(estado).pedidos).toBe(0);
  });
});

describe("avisos parados", () => {
  it("poucos avisos sÃ£o atenÃ§Ã£o", () => {
    const acao = acoesDoDia(dia({ avisosPendentes: 2 })).find((a) => a.chave === "avisos-parados");
    expect(acao?.gravidade).toBe("atencao");
  });

  it("muitos avisos viram crÃ­tico", () => {
    const acao = acoesDoDia(dia({ avisosPendentes: 117 })).find((a) => a.chave === "avisos-parados");
    expect(acao?.gravidade).toBe("critico");
    expect(acao?.titulo).toContain("117");
  });

  it("silÃªncio sÃ³ quando realmente nÃ£o hÃ¡ nada", () => {
    expect(chaves(dia())).toEqual([]);
  });
});

describe("dia nÃ£o montado", () => {
  it("avisa quando nÃ£o existe fatia nenhuma", () => {
    const estado = dia({ sabores: [] });
    expect(chaves(estado)).toContain("dia-vazio");
    expect(frasedoDia(estado)).toContain("ainda nÃ£o tem fatia");
  });
});

describe("loja fechada", () => {
  it("avisa quando hÃ¡ fatia liberada e o site nÃ£o aceita reserva", () => {
    const estado = dia({ lojaAberta: false });
    expect(chaves(estado)).toContain("loja-fechada");
  });

  it("nÃ£o avisa se nÃ£o hÃ¡ o que vender", () => {
    const estado = dia({ lojaAberta: false, sabores: [sabor("x", { liberado: 13, vendido: 13 })] });
    expect(chaves(estado)).not.toContain("loja-fechada");
  });
});

describe("ordem dos sabores no balcÃ£o", () => {
  it("o que estÃ¡ acabando aparece primeiro", () => {
    const sabores = [
      sabor("Sobrando", { liberado: 13, vendido: 1 }),
      sabor("Acabando", { liberado: 13, vendido: 11 }),
      sabor("Esgotado", { liberado: 13, vendido: 13, planejado: 13 }),
    ];
    expect(saboresOrdenados(sabores).map((s) => s.nome)).toEqual([
      "Acabando",
      "Sobrando",
      "Esgotado",
    ]);
  });

  it("esgotado com estoque para liberar sobe, porque tem conserto", () => {
    const sabores = [
      sabor("Sobrando", { liberado: 13, vendido: 1 }),
      sabor("Tem no forno", { planejado: 26, liberado: 13, vendido: 13 }),
    ];
    expect(saboresOrdenados(sabores)[0].nome).toBe("Tem no forno");
  });
});

describe("resumo", () => {
  it("soma disponÃ­vel, a liberar, vendido e receita", () => {
    const estado = dia({
      sabores: [
        sabor("A", { planejado: 13, liberado: 13, vendido: 4 }),
        sabor("B", { planejado: 13, liberado: 6, vendido: 6 }),
      ],
      pedidos: [pedido({ total: 32 }), pedido({ id: "p2", total: 48, status: "pago" })],
    });
    const resumo = resumoDoDia(estado);
    expect(resumo.totalDisponivel).toBe(9);
    expect(resumo.totalALiberar).toBe(7);
    expect(resumo.totalVendido).toBe(10);
    expect(resumo.receita).toBe(80);
  });

  it("dia todo vendido diz que acabou, sem alarme", () => {
    const estado = dia({ sabores: [sabor("A", { planejado: 13, liberado: 13, vendido: 13 })] });
    expect(frasedoDia(estado)).toBe("Tudo vendido por hoje.");
    expect(chaves(estado)).toEqual([]);
  });
});

