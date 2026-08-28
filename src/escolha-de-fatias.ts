// Adoce Hoje — a escolha da fatia.
//
// E a tela onde a venda acontece. Duas regras do Rubens mandam aqui:
//
//   "no lugar de calda black ter escolher calda, o cliente pode escolher sem
//    calda tambem, mas ele precisa escolher — so finaliza depois que ele
//    escolhe"
//
//   "eu quero algo que diminua a quantidade de cliques que o cliente precisa
//    dar para interagir conosco, isso inclui tambem nao ser obrigado a
//    compartilhar algum dado dele que a gente nao tem necessidade de saber"
//
// As duas juntas dao a regra desta tela: **um toque escolhe a fatia, um toque
// escolhe a calda, e acabou.** Nada mais e obrigatorio.
//
// E a fatia-presente e presente: nunca desconto, nunca cupom, nunca valor
// negativo. Ela simplesmente nao soma no total.

export const SEM_CALDA = "Sem calda";

export type Sabor = {
  id: string;
  nome: string;
  preco: number;
  disponiveis: number;
  fotoUrl: string | null;
  premium?: boolean;
};

export type Calda = { id: string; nome: string };

export type Item = {
  saborId: string;
  /** Uma calda por fatia: duas fatias do mesmo sabor podem levar caldas diferentes. */
  caldas: string[];
  /** Quantas destas fatias sao presente do Clube. */
  presentes: number;
};

export const quantidadeDe = (item: Item) => item.caldas.length;

/** Faltando calda em alguma fatia, o pedido nao fecha. */
export const faltaEscolherCalda = (itens: Item[]) =>
  itens.some((i) => i.caldas.some((c) => !c));

export function totalDeFatias(itens: Item[]) {
  return itens.reduce((soma, i) => soma + quantidadeDe(i), 0);
}

export function totalDePresentes(itens: Item[]) {
  return itens.reduce((soma, i) => soma + i.presentes, 0);
}

/**
 * O total em dinheiro. A fatia-presente nao entra na conta — ela nao vira
 * desconto, simplesmente nao e cobrada.
 */
export function total(itens: Item[], sabores: Sabor[]) {
  return itens.reduce((soma, item) => {
    const sabor = sabores.find((s) => s.id === item.saborId);
    if (!sabor) return soma;
    const pagas = Math.max(0, quantidadeDe(item) - item.presentes);
    return soma + pagas * sabor.preco;
  }, 0);
}

/** Quanto ainda cabe deste sabor, considerando o que ja esta no carrinho. */
export function restamDoSabor(itens: Item[], sabor: Sabor) {
  const noCarrinho = itens
    .filter((i) => i.saborId === sabor.id)
    .reduce((s, i) => s + quantidadeDe(i), 0);
  return Math.max(0, sabor.disponiveis - noCarrinho);
}

export const podeAdicionar = (itens: Item[], sabor: Sabor) =>
  restamDoSabor(itens, sabor) > 0;

/**
 * Adiciona uma fatia. A calda entra vazia de proposito: e o proximo toque,
 * e ate ele acontecer o pedido nao fecha.
 */
export function adicionar(itens: Item[], sabor: Sabor): Item[] {
  if (!podeAdicionar(itens, sabor)) return itens;
  const existente = itens.find((i) => i.saborId === sabor.id);
  if (existente) {
    return itens.map((i) =>
      i.saborId === sabor.id ? { ...i, caldas: [...i.caldas, ""] } : i,
    );
  }
  return [...itens, { saborId: sabor.id, caldas: [""], presentes: 0 }];
}

export function remover(itens: Item[], saborId: string): Item[] {
  return itens
    .map((i) => {
      if (i.saborId !== saborId) return i;
      const caldas = i.caldas.slice(0, -1);
      return { ...i, caldas, presentes: Math.min(i.presentes, caldas.length) };
    })
    .filter((i) => i.caldas.length > 0);
}

export function escolherCalda(
  itens: Item[],
  saborId: string,
  posicao: number,
  calda: string,
): Item[] {
  return itens.map((i) =>
    i.saborId === saborId
      ? { ...i, caldas: i.caldas.map((c, n) => (n === posicao ? calda : c)) }
      : i,
  );
}

/**
 * Marca uma fatia como presente do Clube. Nao ha limite por sabor: o presente
 * e do cliente, e ele escolhe onde usar.
 */
export function usarPresente(itens: Item[], saborId: string, disponiveis: number): Item[] {
  if (totalDePresentes(itens) >= disponiveis) return itens;
  return itens.map((i) =>
    i.saborId === saborId && i.presentes < quantidadeDe(i)
      ? { ...i, presentes: i.presentes + 1 }
      : i,
  );
}

export const podeFinalizar = (itens: Item[]) =>
  itens.length > 0 && !faltaEscolherCalda(itens);

/**
 * O que impede de fechar, em uma frase. Some quando nao ha impedimento —
 * aviso permanente ocupando a tela vira ruido.
 */
export function oQueFalta(itens: Item[]) {
  if (!itens.length) return "";
  const sem = itens.reduce((s, i) => s + i.caldas.filter((c) => !c).length, 0);
  if (!sem) return "";
  return sem === 1
    ? "Falta escolher a calda de uma fatia."
    : `Faltam escolher as caldas de ${sem} fatias.`;
}

/** "Últimas 3" vira motivo para escolher agora — mas só quando é verdade. */
export function avisoDeEstoque(sabor: Sabor) {
  if (sabor.disponiveis <= 0) return "esgotado";
  if (sabor.disponiveis <= 3) return `últimas ${sabor.disponiveis}`;
  return `${sabor.disponiveis} fatias`;
}

export function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(valor)
    // O Intl separa "R$" do numero com espaco nao separavel (U+00A0) ou com o
    // estreito (U+202F). Invisivel na tela, mas quebra comparacao e busca.
    // Escrito por codigo de proposito: escapar depende do arquivo chegar
    // intacto, e neste projeto a codificacao ja quebrou quatro vezes.
    .replace(/[\u00A0\u202F\u2007]/g, " ");
}

/**
 * O resumo que vai para a operacao e para a mensagem do cliente.
 * Presente aparece como presente, com o simbolo — nunca como valor abatido.
 */
export function resumoDoPedido(itens: Item[], sabores: Sabor[]) {
  return itens.map((item) => {
    const sabor = sabores.find((s) => s.id === item.saborId);
    const porCalda = new Map<string, number>();
    for (const c of item.caldas) porCalda.set(c || SEM_CALDA, (porCalda.get(c || SEM_CALDA) || 0) + 1);
    return {
      sabor: sabor?.nome || "",
      quantidade: quantidadeDe(item),
      presentes: item.presentes,
      caldas: [...porCalda.entries()].map(([nome, quantas]) => ({ nome, quantas })),
    };
  });
}
