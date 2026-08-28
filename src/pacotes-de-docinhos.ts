// Docinhos: a Adoce vende em pacotes de 25, 50 e 100.
//
// Regra do Rubens, em 10/08: "venda somente em multiplos de 25. Pacotes
// possiveis: 25, 50 e 100. O carrinho deve compor automaticamente os pacotes
// conforme os sabores/quantidades: por exemplo, 125 unidades = 100 + 25."
//
// Hoje a tela deixa escolher 15, 14 e 10 — combinacoes que a Adoce nao vende —
// e so avisa do limite DEPOIS que a pessoa ja escolheu. Erro que aparece
// depois do esforco e erro que a gente empurrou para o cliente.
//
// Aqui as quantidades impossiveis simplesmente nao existem.

export const PACOTES = [100, 50, 25] as const;
export const MULTIPLO = 25;

export type Pacote = (typeof PACOTES)[number];

/** Quantos sabores cabem em cada pacote. Um sabor a cada 25 unidades. */
export const saboresPermitidos = (pacote: Pacote) => pacote / MULTIPLO;

export type Escolha = { sabor: string; unidades: number };

/**
 * Decompoe a quantidade nos maiores pacotes possiveis.
 * 125 vira 100 + 25. 175 vira 100 + 50 + 25.
 */
export function comporPacotes(unidades: number): Pacote[] {
  if (unidades < MULTIPLO) return [];
  let resto = Math.floor(unidades / MULTIPLO) * MULTIPLO;
  const composicao: Pacote[] = [];
  for (const pacote of PACOTES) {
    while (resto >= pacote) {
      composicao.push(pacote);
      resto -= pacote;
    }
  }
  return composicao;
}

/** "100 + 25" — para a tela mostrar como o pedido foi montado. */
export const descreverComposicao = (unidades: number) =>
  comporPacotes(unidades).join(" + ");

/** Arredonda para o multiplo de 25 mais proximo, nunca abaixo de 25. */
export function ajustarParaMultiplo(unidades: number) {
  if (unidades <= 0) return 0;
  const arredondado = Math.round(unidades / MULTIPLO) * MULTIPLO;
  return Math.max(MULTIPLO, arredondado);
}

export const ehQuantidadeValida = (unidades: number) =>
  unidades >= MULTIPLO && unidades % MULTIPLO === 0;

export const totalEscolhido = (escolhas: Escolha[]) =>
  escolhas.reduce((soma, e) => soma + e.unidades, 0);

/**
 * Quanto ainda cabe deste sabor, considerando o pacote e o que ja foi
 * escolhido. Zero significa que o botao de somar fica desabilitado —
 * e nao que aparece um aviso depois.
 */
export function cabeMais(escolhas: Escolha[], pacote: Pacote, sabor: string) {
  const usado = totalEscolhido(escolhas);
  const livre = pacote - usado;
  if (livre < MULTIPLO) return 0;

  const jaEscolhido = escolhas.some((e) => e.sabor === sabor && e.unidades > 0);
  if (!jaEscolhido) {
    const distintos = escolhas.filter((e) => e.unidades > 0).length;
    if (distintos >= saboresPermitidos(pacote)) return 0;
  }
  return livre;
}

/** O sabor pode receber mais unidades agora? Serve para desabilitar o botao. */
export const podeSomar = (escolhas: Escolha[], pacote: Pacote, sabor: string) =>
  cabeMais(escolhas, pacote, sabor) >= MULTIPLO;

export function somar(escolhas: Escolha[], pacote: Pacote, sabor: string): Escolha[] {
  if (!podeSomar(escolhas, pacote, sabor)) return escolhas;
  const existente = escolhas.find((e) => e.sabor === sabor);
  if (existente) {
    return escolhas.map((e) =>
      e.sabor === sabor ? { ...e, unidades: e.unidades + MULTIPLO } : e,
    );
  }
  return [...escolhas, { sabor, unidades: MULTIPLO }];
}

export function subtrair(escolhas: Escolha[], sabor: string): Escolha[] {
  return escolhas
    .map((e) => (e.sabor === sabor ? { ...e, unidades: e.unidades - MULTIPLO } : e))
    .filter((e) => e.unidades > 0);
}

export const pedidoCompleto = (escolhas: Escolha[], pacote: Pacote) =>
  totalEscolhido(escolhas) === pacote;

/**
 * O que falta para fechar. Some quando estiver completo — nada de aviso
 * permanente ocupando a tela.
 */
export function faltaPara(escolhas: Escolha[], pacote: Pacote) {
  const falta = pacote - totalEscolhido(escolhas);
  if (falta <= 0) return "";
  const sabores = Math.ceil(falta / MULTIPLO);
  return `Faltam ${falta} docinhos — escolha mais ${sabores} ${sabores === 1 ? "sabor" : "sabores"}.`;
}
