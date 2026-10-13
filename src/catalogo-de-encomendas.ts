// Catálogo de encomendas atualmente oferecidas: tortas e docinhos.

export type Segmento = "cakes" | "sweets";

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
  { chave: "cakes", titulo: "Tortas", chamada: "Inteiras, por encomenda", rota: "/encomendas/tortas" },
  { chave: "sweets", titulo: "Docinhos", chamada: "Em pacotes de 25, 50 ou 100", rota: "/encomendas/docinhos" },
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
