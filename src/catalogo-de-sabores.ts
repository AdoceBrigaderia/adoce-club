// Nossos sabores — a vitrine que nao depende do estoque.
//
// Pedido do Rubens em 10/08, e ele acertou o diagnostico:
//
//   "do jeito que ta, o cliente so consegue ver as tortas se existir estoque,
//    dai nao tem como gerar a vontade nele"
//
// Sabor que so aparece quando tem, some do mundo do cliente. E ninguem deseja
// o que nao sabe que existe. Aqui os 26 sabores aparecem sempre, com foto,
// descricao e ingredientes — que ja estao cadastrados e nunca foram mostrados.
//
// O que muda conforme o dia e o **estado**, nao a existencia:
//   hoje    · tem agora, pode reservar
//   previsto· ja tem dia marcado para sair
//   ausente · nao esta na semana, mas da para pedir aviso e encomendar

export type Sabor = {
  id: string;
  nome: string;
  /** Uma linha escrita para a vitrine. Vem de `flavor_summaries`. */
  resumo: string;
  /** Ficha tecnica completa, de `flavors.description`. Nao vai para a vitrine. */
  descricao: string;
  ingredientes: string;
  preco: number;
  fotoFatia: string | null;
  fotoTorta: string | null;
  /** Torta inteira disponivel por encomenda. */
  tortaInteira: boolean;
  precoTorta: number | null;
  categoria: string | null;
};

export type Estado = "hoje" | "previsto" | "ausente";

export type SituacaoDoSabor = {
  estado: Estado;
  /** Quantas fatias restam hoje. So faz sentido no estado "hoje". */
  disponiveis: number;
  /** Proxima data prevista, quando houver cardapio fixo. */
  proximaData: string | null;
  /** "quinta-feira", quando a data for conhecida. */
  proximoDia: string | null;
};

export type SaborNaVitrine = Sabor & SituacaoDoSabor;

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export const nomeDoDia = (data: Date) => DIAS[data.getUTCDay()];

/**
 * A frase de estado, que e o que faz o cliente decidir.
 * Nunca diz "esgotado" seco: esgotado sem alternativa e cliente que vai embora.
 */
export function frasedoEstado(sabor: SaborNaVitrine) {
  if (sabor.estado === "hoje") {
    if (sabor.disponiveis <= 0) return "Acabou hoje — avisamos quando voltar";
    if (sabor.disponiveis <= 3) return `Últimas ${sabor.disponiveis} de hoje`;
    return `${sabor.disponiveis} fatias hoje`;
  }
  if (sabor.estado === "previsto" && sabor.proximoDia) {
    return `Sai ${sabor.proximoDia}`;
  }
  return "Avisamos quando sair";
}

/** Pode reservar agora? Só quem tem fatia sobrando hoje. */
export const podeReservarAgora = (sabor: SaborNaVitrine) =>
  sabor.estado === "hoje" && sabor.disponiveis > 0;

/**
 * A ordem da vitrine: primeiro o que da para levar hoje, depois o que ja tem
 * dia marcado, e por fim o resto — que continua visivel, so nao na frente.
 */
export function ordenar(sabores: SaborNaVitrine[]) {
  const peso = (s: SaborNaVitrine) => {
    if (s.estado === "hoje" && s.disponiveis > 0) return 0;
    if (s.estado === "previsto") return 1;
    if (s.estado === "hoje") return 2; // acabou hoje
    return 3;
  };
  return [...sabores].sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function contar(sabores: SaborNaVitrine[]) {
  return {
    total: sabores.length,
    hoje: sabores.filter((s) => s.estado === "hoje" && s.disponiveis > 0).length,
    previstos: sabores.filter((s) => s.estado === "previsto").length,
  };
}

/**
 * A pergunta que o cliente manda quando o sabor nao esta disponivel.
 * Curta e especifica: quem recebe sabe responder sem perguntar de volta.
 */
export function perguntaSobreOSabor(sabor: Sabor) {
  return `Oi! Quando vocês vão fazer ${sabor.nome} de novo? 🍰`;
}

export function pedidoDeTortaInteira(sabor: Sabor) {
  return `Oi! Queria encomendar uma torta inteira de ${sabor.nome}. 🍰`;
}

export function linkDeWhatsApp(texto: string, zap = "5585982156026") {
  return `https://wa.me/${zap}?text=${encodeURIComponent(texto)}`;
}

export function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(valor)
    .replace(/[\u00A0\u202F\u2007]/g, " ");
}

/**
 * Ingredientes viram lista legivel. Fora da vitrine — o Rubens tirou de la em
 * 10/08: "fica muito texto pra pessoa ler". Continua servindo para a ficha
 * tecnica e para quem tem alergia.
 */
export function listaDeIngredientes(sabor: Sabor) {
  return sabor.ingredientes
    .split(/[,;]/)
    .map((i) => i.trim())
    .filter(Boolean);
}
