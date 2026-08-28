import { quando } from "./datas";

export { quando } from "./datas";

// Impressora termica Knup 1025, por Bluetooth.
//
// Papel de 58 mm com 48 mm de area util — 32 colunas na fonte padrao. Fala
// ESC/POS, como quase toda termica dessa faixa.
//
// Este arquivo monta os bytes. Quem conversa com o aparelho e
// `conexao-bluetooth.ts`; separado de proposito, porque o Bluetooth so existe
// no navegador e isto aqui precisa ser testavel.
//
// Duas armadilhas que custam papel e tempo, resolvidas aqui:
//
// 1. **Acento.** Termica nao fala UTF-8. Sem escolher a pagina de codigo certa,
//    "Ração" sai "RaÃ§Ã£o". Usamos CP860, que e a portuguesa.
// 2. **Largura.** Linha maior que 32 colunas nao quebra sozinha: ela some no
//    corte lateral. Aqui a quebra e feita por palavra, antes de imprimir.

export const COLUNAS = 32;

const ESC = 0x1b;
const GS = 0x1d;

export const COMANDOS = {
  iniciar: [ESC, 0x40],
  paginaCodigoPortugues: [ESC, 0x74, 0x03], // CP860
  alinharEsquerda: [ESC, 0x61, 0x00],
  alinharCentro: [ESC, 0x61, 0x01],
  negritoLigado: [ESC, 0x45, 0x01],
  negritoDesligado: [ESC, 0x45, 0x00],
  dobroLigado: [GS, 0x21, 0x11],
  dobroDesligado: [GS, 0x21, 0x00],
  avancar: (linhas: number) => [ESC, 0x64, linhas],
  cortar: [GS, 0x56, 0x42, 0x00],
} as const;

/**
 * Tabela CP860 para os caracteres que a Adoce usa de fato.
 * Fora dela, o caractere vira a versao sem acento — melhor um "a" do que um
 * quadrado preto no meio do nome do cliente.
 */
const CP860: Record<string, number> = {
  "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ã": 0x84, "à": 0x85,
  "Á": 0x86, "ç": 0x87, "ê": 0x88, "Ê": 0x89, "è": 0x8a, "Í": 0x8b,
  "Ô": 0x8c, "ì": 0x8d, "Ã": 0x8e, "Â": 0x8f, "É": 0x90, "À": 0x91,
  "È": 0x92, "ô": 0x93, "õ": 0x94, "ò": 0x95, "Ú": 0x96, "ù": 0x97,
  "Ì": 0x98, "Õ": 0x99, "Ü": 0x9a, "¢": 0x9b, "£": 0x9c, "Ù": 0x9d,
  "₧": 0x9e, "Ó": 0x9f, "á": 0xa0, "í": 0xa1, "ó": 0xa2, "ú": 0xa3,
  "ñ": 0xa4, "Ñ": 0xa5, "º": 0xa7, "ª": 0xa6,
};

const SEM_ACENTO = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function paraBytes(texto: string): number[] {
  const bytes: number[] = [];
  for (const ch of texto) {
    if (CP860[ch] !== undefined) { bytes.push(CP860[ch]); continue; }
    const codigo = ch.charCodeAt(0);
    if (codigo < 128) { bytes.push(codigo); continue; }
    // Fora da tabela: cai para a versao sem acento, caractere a caractere.
    for (const simples of SEM_ACENTO(ch)) {
      const c = simples.charCodeAt(0);
      bytes.push(c < 128 ? c : 0x3f); // "?" so em ultimo caso
    }
  }
  return bytes;
}

/** Quebra por palavra. Linha estourada some no corte lateral do papel. */
export function quebrarLinha(texto: string, largura = COLUNAS): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean);
  if (!palavras.length) return [""];
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of palavras) {
    if (!atual) { atual = palavra; continue; }
    if ((atual + " " + palavra).length <= largura) { atual += " " + palavra; continue; }
    linhas.push(atual);
    atual = palavra;
  }
  if (atual) linhas.push(atual);
  // Palavra unica maior que a largura: parte no seco, senao some.
  return linhas.flatMap((l) =>
    l.length <= largura ? [l] : (l.match(new RegExp(`.{1,${largura}}`, "g")) || [l]),
  );
}

export const centralizar = (texto: string, largura = COLUNAS) => {
  const t = texto.slice(0, largura);
  const espacos = Math.max(0, Math.floor((largura - t.length) / 2));
  return " ".repeat(espacos) + t;
};

/** "2x Chocolatudo            R$ 32,00" — nome à esquerda, valor à direita. */
export function doisLados(esquerda: string, direita: string, largura = COLUNAS) {
  const espaco = largura - direita.length;
  const e = esquerda.length > espaco - 1 ? esquerda.slice(0, espaco - 2) + "…" : esquerda;
  return e + " ".repeat(Math.max(1, largura - e.length - direita.length)) + direita;
}

export const linhaTracejada = (largura = COLUNAS) => "-".repeat(largura);

export type ItemDaFicha = {
  sabor: string;
  quantidade: number;
  calda: string | null;
  presente: boolean;
};

export type Ficha = {
  numero: string;
  cliente: string;
  telefone: string;
  itens: ItemDaFicha[];
  total: number;
  retirada: string | null;
  observacao: string | null;
  /** Quando o CLIENTE fez o pedido. E a data que resolve discussao no balcao. */
  criadoEm: string;
  /** Quando a ficha saiu da impressora. Nunca confundir com a de cima. */
  impressoEm?: string;
};

/** "12/08/2026 as 02h17" — data curta, do jeito que se fala. */
const dinheiro = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(v)
    .replace(/[\u00A0\u202F\u2007]/g, " ");

/**
 * O texto da ficha, em 32 colunas. Separado dos bytes para poder ser lido e
 * testado — e para a operacao conferir na tela antes de gastar papel.
 */
export function montarTexto(ficha: Ficha): string[] {
  const linhas: string[] = [];

  linhas.push(centralizar("ADOCE BRIGADERIA"));
  linhas.push(centralizar("Confeitaria artesanal"));
  linhas.push("");
  linhas.push(centralizar(ficha.numero));
  // A data do PEDIDO fica colada no numero. E ela que resolve "eu pedi antes
  // dela" no balcao, e ela que diz se o pedido esta esperando ha tempo demais.
  linhas.push(centralizar(`Pedido em ${quando(ficha.criadoEm)}`));
  linhas.push(linhaTracejada());

  linhas.push("CLIENTE");
  linhas.push(...quebrarLinha(ficha.cliente));
  linhas.push(ficha.telefone);
  linhas.push(linhaTracejada());

  linhas.push("PEDIDO");
  for (const item of ficha.itens) {
    linhas.push(`${item.quantidade}x ${item.sabor}`.slice(0, COLUNAS));
    linhas.push(`   ${item.calda || "Sem calda"}`.slice(0, COLUNAS));
    if (item.presente) linhas.push("   * PRESENTE DO CLUBE *");
  }

  linhas.push(linhaTracejada());
  const fatias = ficha.itens.reduce((s, i) => s + i.quantidade, 0);
  linhas.push(doisLados(`${fatias} ${fatias === 1 ? "FATIA" : "FATIAS"}`, dinheiro(ficha.total)));

  if (ficha.observacao) {
    linhas.push(linhaTracejada());
    linhas.push("OBSERVACAO");
    linhas.push(...quebrarLinha(ficha.observacao));
  }

  if (ficha.retirada) {
    linhas.push(linhaTracejada());
    linhas.push("RETIRADA");
    linhas.push(...quebrarLinha(ficha.retirada));
  }

  linhas.push(linhaTracejada());
  linhas.push(centralizar("Feito pelas maos da Beth"));
  linhas.push(centralizar("Obrigado por adocar"));
  linhas.push(centralizar("seu momento com a gente"));
  linhas.push("");
  // Discreta, no fim, e sempre com o rotulo. Sem rotulo ela vira data do pedido
  // na cabeca de quem le com pressa.
  linhas.push(centralizar(`impresso ${quando(ficha.impressoEm || new Date().toISOString())}`));

  return linhas;
}

/** Os bytes que vao para a impressora. */
export function montarBytes(ficha: Ficha): Uint8Array {
  const saida: number[] = [];
  const push = (...b: number[]) => saida.push(...b);

  push(...COMANDOS.iniciar);
  push(...COMANDOS.paginaCodigoPortugues);

  const linhas = montarTexto(ficha);
  for (const [indice, linha] of linhas.entries()) {
    // O numero do pedido sai em corpo dobrado: e o que a operacao procura
    // primeiro quando ha varias fichas na bancada.
    const destacar = linha.trim() === ficha.numero;
    if (destacar) push(...COMANDOS.negritoLigado, ...COMANDOS.dobroLigado, ...COMANDOS.alinharCentro);
    push(...paraBytes(linha), 0x0a);
    if (destacar) push(...COMANDOS.dobroDesligado, ...COMANDOS.negritoDesligado, ...COMANDOS.alinharEsquerda);
    if (indice === 0) push(...COMANDOS.alinharEsquerda);
  }

  push(...COMANDOS.avancar(4));
  push(...COMANDOS.cortar);
  return new Uint8Array(saida);
}

/**
 * A impressora recebe em pedacos pequenos: o buffer dela e curto e pacote
 * grande demais chega truncado, imprimindo meia ficha.
 */
export function fatiar(bytes: Uint8Array, tamanho = 180): Uint8Array[] {
  const pedacos: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += tamanho) {
    pedacos.push(bytes.slice(i, i + tamanho));
  }
  return pedacos;
}
