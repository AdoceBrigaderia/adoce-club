// O catalogo de encomendas — tortas, docinhos, festas, escola e decoracao.
//
// Hoje existem tres componentes diferentes para a mesma tarefa (pedir alguma
// coisa) e cinco rotas separadas, cada uma de uma safra. Festas, Escola e
// Decoracao ficaram escondidas num link discreto embaixo das outras.
//
// Decisao do Rubens em 10/08: "enquanto a Beth nao falar que vamos encerrar
// com as Festas, Escola e Decoracao, isso precisa fazer parte" — com peso
// visual igual ao de Tortas e Docinhos.
//
// Aqui e uma tela so, com os cinco segmentos lado a lado. Trocar de segmento
// nao volta para a home: era a reclamacao de que "a pagina de tortas deve ter
// acesso direto aos docinhos".
//
// Os dados sao reais, conferidos no banco de producao em 10/08/2026:
// Torta P 115 · M 155 · G 195 · docinhos a partir de 35 · tabuleiros 320 a 550
// · escola 390 a 950 · decoracao 50 e 100.

export type Segmento = "cakes" | "sweets" | "events" | "school" | "rentals";

export type Produto = {
  id: string;
  segmento: Segmento;
  nome: string;
  resumo: string;
  preco: number;
  /** "a partir de", "15 crianças" — vem do banco. */
  sufixo: string;
  minimo: number;
  prazoDiasUteis: number;
  fotoUrl: string | null;
  publicado: boolean;
  ordem: number;
};

export const SEGMENTOS: Array<{
  chave: Segmento;
  titulo: string;
  chamada: string;
  rota: string;
}> = [
  { chave: "cakes", titulo: "Tortas", chamada: "Inteiras, por encomenda", rota: "#encomendas/tortas" },
  { chave: "sweets", titulo: "Docinhos", chamada: "Em pacotes de 25, 50 ou 100", rota: "#encomendas/docinhos" },
  { chave: "events", titulo: "Festas e eventos", chamada: "Tabuleiros e kits", rota: "#encomendas/festas" },
  { chave: "school", titulo: "Adoce na Escola", chamada: "Comemorar na sala", rota: "#encomendas/escola" },
  { chave: "rentals", titulo: "Decoração", chamada: "Para alugar e montar", rota: "#encomendas/decoracao" },
];

export const tituloDoSegmento = (s: Segmento) =>
  SEGMENTOS.find((x) => x.chave === s)?.titulo || "Encomendas";

export const segmentoDaRota = (hash: string): Segmento | null =>
  SEGMENTOS.find((s) => hash.startsWith(s.rota))?.chave || null;

export function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: valor % 1 === 0 ? 0 : 2,
  })
    .format(valor)
    // O Intl separa "R$" do numero com espaco nao separavel (U+00A0) e, em
    // alguns ambientes, com o estreito (U+202F). Invisivel na tela, mas quebra
    // comparacao, busca e teste. Fica um espaco comum.
    .replace(/[  ]/g, " ");
}

/**
 * "R$ 115" · "a partir de R$ 35" · "R$ 390 para 15 crianças"
 * O sufixo do banco muda o lugar onde entra, entao a regra fica aqui e nao
 * espalhada pela tela.
 */
export function precoPorExtenso(produto: Produto) {
  const valor = dinheiro(produto.preco);
  const sufixo = produto.sufixo.trim();
  if (!sufixo) return valor;
  if (/^a partir de$/i.test(sufixo)) return `a partir de ${valor}`;
  return `${valor} para ${sufixo}`;
}

/** "3 dias úteis de antecedência" — a promessa que a operação consegue cumprir. */
export const prazoPorExtenso = (produto: Produto) =>
  `${produto.prazoDiasUteis} ${produto.prazoDiasUteis === 1 ? "dia útil" : "dias úteis"} de antecedência`;

/**
 * Produto sem foto continua aparecendo — esconder seria pior, porque o cliente
 * deixa de saber que existe. Mas a tela precisa saber, para desenhar um lugar
 * digno em vez de um quadrado quebrado.
 */
export const precisaDeFoto = (produto: Produto) => !produto.fotoUrl;

export function produtosDoSegmento(produtos: Produto[], segmento: Segmento) {
  return produtos
    .filter((p) => p.publicado && p.segmento === segmento)
    .sort((a, b) => a.ordem - b.ordem || a.preco - b.preco);
}

/**
 * A partir de quanto sai cada segmento. Serve para o cartao do segmento
 * mostrar preco sem o cliente precisar entrar para descobrir.
 */
export function menorPrecoDoSegmento(produtos: Produto[], segmento: Segmento) {
  const lista = produtosDoSegmento(produtos, segmento);
  if (!lista.length) return null;
  return Math.min(...lista.map((p) => p.preco));
}

/** Quantos produtos cada segmento tem, para não abrir uma seção vazia. */
export function segmentosComProduto(produtos: Produto[]) {
  return SEGMENTOS.filter((s) => produtosDoSegmento(produtos, s.chave).length > 0);
}

/**
 * Mensagem pronta para o WhatsApp, o caminho que realmente funciona hoje.
 * Sem link: quem esta sem dado movel nao abre, e pedir isso constrange.
 */
export function mensagemDeInteresse(produto: Produto) {
  return [
    `Oi! Queria saber sobre ${produto.nome}.`,
    produto.minimo > 1 ? `Mínimo de ${produto.minimo}.` : "",
    `Vi por ${precoPorExtenso(produto)}.`,
  ].filter(Boolean).join(" ");
}
