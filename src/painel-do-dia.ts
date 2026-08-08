// O painel do dia da operacao â€” as regras.
//
// Existem cerca de 40 telas de operacao neste projeto. O Rubens nao acha o
// botao de liberar producao porque ele esta em uma entre quarenta. Em 28/07 a
// loja ficou 11 dias marcada como esgotada e ninguem percebeu: havia 78 fatias
// planejadas que o botao nao enxergava.
//
// Este arquivo nao desenha nada. Ele responde tres perguntas, na ordem em que
// importam de manha:
//
//   1. O que precisa da minha acao agora?
//   2. Quanto ainda tenho para vender hoje?
//   3. O que ja aconteceu?
//
// Regra de ouro: quando faltar informacao, este arquivo diz que falta. Ele
// nunca inventa "tudo certo" no silencio â€” foi exatamente assim que os 11 dias
// passaram despercebidos.

export type SaborDoDia = {
  flavorId: string;
  nome: string;
  /** Quantas fatias foram planejadas na producao da semana. */
  planejado: number;
  /** Quantas ja foram liberadas para venda. */
  liberado: number;
  /** Quantas ja foram vendidas ou reservadas. */
  vendido: number;
  preco: number;
};

export type PedidoDoDia = {
  id: string;
  numero: string;
  cliente: string;
  fatias: number;
  total: number;
  criadoEm: string;
  /** Momento combinado de retirada, quando houver. */
  retiradaEm: string | null;
  status: "novo" | "separado" | "pago" | "retirado" | "cancelado";
};

export type EstadoDoDia = {
  data: string;
  lojaAberta: boolean;
  sabores: SaborDoDia[];
  pedidos: PedidoDoDia[];
  /** Avisos ainda nao entregues. Ver operation_notifications. */
  avisosPendentes: number;
};

export type Gravidade = "critico" | "atencao" | "informativo";

export type Acao = {
  chave: string;
  gravidade: Gravidade;
  titulo: string;
  detalhe: string;
  /** Rotulo do botao, quando houver uma acao direta. */
  botao?: string;
};

export const disponivel = (sabor: SaborDoDia) =>
  Math.max(0, sabor.liberado - sabor.vendido);

export const aLiberar = (sabor: SaborDoDia) =>
  Math.max(0, sabor.planejado - sabor.liberado);

export function resumoDoDia(estado: EstadoDoDia) {
  const sabores = estado.sabores;
  const totalDisponivel = sabores.reduce((soma, s) => soma + disponivel(s), 0);
  const totalALiberar = sabores.reduce((soma, s) => soma + aLiberar(s), 0);
  const totalVendido = sabores.reduce((soma, s) => soma + s.vendido, 0);
  const totalPlanejado = sabores.reduce((soma, s) => soma + s.planejado, 0);

  const pedidosValidos = estado.pedidos.filter((p) => p.status !== "cancelado");
  const receita = pedidosValidos.reduce((soma, p) => soma + p.total, 0);

  return {
    totalDisponivel,
    totalALiberar,
    totalVendido,
    pedidos: pedidosValidos.length,
    receita,
    totalPlanejado,
    /**
     * O dia nao foi montado. Repare que isto NAO e o mesmo que estar esgotado:
     * dia esgotado teve producao e vendeu tudo, e nao pede acao nenhuma.
     * Confundir os dois faria o painel gritar justamente no melhor dia.
     */
    diaVazio: totalPlanejado === 0 && totalDisponivel === 0,
  };
}

/**
 * O que precisa da acao do Rubens agora, em ordem de urgencia.
 *
 * Esta lista e o coracao do painel. Se ela estiver vazia, o dia esta sob
 * controle. Se nao estiver, ela e a primeira coisa que ele ve.
 */
export function acoesDoDia(estado: EstadoDoDia): Acao[] {
  const acoes: Acao[] = [];
  const resumo = resumoDoDia(estado);

  // 1. Pedido sem resposta. Foi isso que custou a Juliana.
  const novos = estado.pedidos.filter((p) => p.status === "novo");
  if (novos.length) {
    acoes.push({
      chave: "pedidos-novos",
      gravidade: "critico",
      titulo: novos.length === 1
        ? "1 pedido esperando resposta"
        : `${novos.length} pedidos esperando resposta`,
      detalhe: novos.length === 1
        ? `${novos[0].cliente} pediu ${novos[0].fatias} ${novos[0].fatias === 1 ? "fatia" : "fatias"}.`
        : "Cliente que pede e nÃ£o recebe retorno nÃ£o volta.",
      botao: "Ver pedidos",
    });
  }

  // 2. Avisos que ninguem entregou. O sintoma de que a fila parou.
  if (estado.avisosPendentes > 0) {
    acoes.push({
      chave: "avisos-parados",
      gravidade: estado.avisosPendentes > 5 ? "critico" : "atencao",
      titulo: `${estado.avisosPendentes} ${estado.avisosPendentes === 1 ? "aviso nÃ£o entregue" : "avisos nÃ£o entregues"}`,
      detalhe: "Os avisos estÃ£o registrados, mas ninguÃ©m recebeu no celular.",
    });
  }

  // 3. Producao planejada e nao liberada: fatia pronta que o site nao vende.
  if (resumo.totalALiberar > 0) {
    acoes.push({
      chave: "liberar-producao",
      gravidade: resumo.totalDisponivel === 0 ? "critico" : "atencao",
      titulo: `${resumo.totalALiberar} ${resumo.totalALiberar === 1 ? "fatia pronta" : "fatias prontas"} sem liberar`,
      detalhe: resumo.totalDisponivel === 0
        ? "O site estÃ¡ mostrando esgotado enquanto essas fatias esperam."
        : "Liberar deixa essas fatias disponÃ­veis para reserva agora.",
      botao: "Liberar produÃ§Ã£o",
    });
  }

  // 4. O dia nao foi montado.
  if (resumo.diaVazio) {
    acoes.push({
      chave: "dia-vazio",
      gravidade: "critico",
      titulo: "Nenhuma fatia cadastrada para hoje",
      detalhe: "Sem produÃ§Ã£o cadastrada, o site mostra a loja esgotada.",
      botao: "Cadastrar produÃ§Ã£o",
    });
  }

  // 5. Loja fechada com fatia disponivel: ninguem consegue reservar.
  if (!estado.lojaAberta && resumo.totalDisponivel > 0) {
    acoes.push({
      chave: "loja-fechada",
      gravidade: "atencao",
      titulo: "Loja fechada com fatias disponÃ­veis",
      detalhe: `${resumo.totalDisponivel} ${resumo.totalDisponivel === 1 ? "fatia estÃ¡" : "fatias estÃ£o"} liberadas, mas o site nÃ£o aceita reserva.`,
    });
  }

  // 6. Separado e ainda nao pago, ja perto da retirada.
  const separados = estado.pedidos.filter((p) => p.status === "separado");
  if (separados.length) {
    acoes.push({
      chave: "aguardando-pagamento",
      gravidade: "informativo",
      titulo: `${separados.length} ${separados.length === 1 ? "pedido separado" : "pedidos separados"} aguardando pagamento`,
      detalhe: "O cliente sÃ³ paga depois que a Adoce confirma a reserva.",
    });
  }

  const ordem: Record<Gravidade, number> = { critico: 0, atencao: 1, informativo: 2 };
  return acoes.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);
}

/**
 * Sabores ordenados como o balcao precisa ver: primeiro o que esta acabando,
 * depois o que tem de sobra, e por ultimo o que ja esgotou.
 */
export function saboresOrdenados(sabores: SaborDoDia[]) {
  const peso = (s: SaborDoDia) => {
    const restante = disponivel(s);
    if (restante === 0 && aLiberar(s) > 0) return 1; // esgotado mas com estoque para liberar
    if (restante === 0) return 3;
    if (restante <= 3) return 0; // acabando: o mais importante
    return 2;
  };
  return [...sabores].sort((a, b) => {
    const diferenca = peso(a) - peso(b);
    if (diferenca !== 0) return diferenca;
    return disponivel(a) - disponivel(b);
  });
}

/** Frase curta do topo, que resume o dia em uma linha. */
export function frasedoDia(estado: EstadoDoDia) {
  const resumo = resumoDoDia(estado);
  if (resumo.diaVazio) return "Hoje ainda nÃ£o tem fatia cadastrada.";
  if (resumo.totalDisponivel === 0 && resumo.totalALiberar === 0)
    return "Tudo vendido por hoje.";
  if (resumo.totalDisponivel === 0 && resumo.totalALiberar > 0)
    return `Esgotado no site, com ${resumo.totalALiberar} para liberar.`;
  if (resumo.totalDisponivel === 0) return "Tudo vendido por hoje.";
  return `${resumo.totalDisponivel} ${resumo.totalDisponivel === 1 ? "fatia disponÃ­vel" : "fatias disponÃ­veis"} agora.`;
}

export function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

