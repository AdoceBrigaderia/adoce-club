// Pede Junto — cada um paga a sua.
//
// O Rubens descreveu o gargalo com precisao:
//
//   "hoje o organizador pergunta tudo, fica com toda a responsabilidade dos
//    pagamentos e isso faz com que eles desistam"
//
// Ja existe demanda, ja existe quem organize, e a venda morre no ponto em que
// uma pessoa precisa cobrar os amigos. Tirar o dinheiro das costas do
// organizador e a mudanca que destrava o Pede Junto.
//
// Regras que valem aqui:
//
// - **Cinco fatias e o minimo, nao o teto.** Ja houve grupo com onze moradores.
// - **O cliente so paga depois que a Adoce confirma que separou.** Enquanto o
//   grupo esta aberto, ninguem paga nada.
// - **O organizador nunca ve o pagamento dos outros.** Ele ve quem ja acertou,
//   nao com que cartao nem quanto sobrou no bolso de ninguem.

export const MINIMO_ENTREGA_GRATIS = 5;

export type EstadoDoPagamento =
  | "aguardando_fechamento" // o grupo ainda esta aberto
  | "a_pagar"               // a Adoce separou, e a hora de pagar
  | "processando"
  | "pago"
  | "expirado";

export type ParticipanteDoPagamento = {
  id: string;
  nome: string;
  fatias: number;
  valor: number;
  estado: EstadoDoPagamento;
  /** Link individual do Mercado Pago. So existe depois do fechamento. */
  linkDePagamento: string | null;
  expiraEm: string | null;
};

export type GrupoDePagamento = {
  nome: string;
  totalDeFatias: number;
  entregaGratis: boolean;
  fechado: boolean;
  /** A Adoce ja confirmou que separou tudo. */
  separado: boolean;
  participantes: ParticipanteDoPagamento[];
};

/**
 * A regra do Rubens, aplicada ao grupo: ninguem paga antes de a Adoce
 * confirmar que separou. Nem o organizador.
 */
export const podeCobrar = (grupo: GrupoDePagamento) =>
  grupo.fechado && grupo.separado;

export const jaPagaram = (grupo: GrupoDePagamento) =>
  grupo.participantes.filter((p) => p.estado === "pago");

export const faltamPagar = (grupo: GrupoDePagamento) =>
  grupo.participantes.filter((p) => p.estado === "a_pagar" || p.estado === "expirado");

export const totalDoGrupo = (grupo: GrupoDePagamento) =>
  grupo.participantes.reduce((soma, p) => soma + p.valor, 0);

export const totalRecebido = (grupo: GrupoDePagamento) =>
  jaPagaram(grupo).reduce((soma, p) => soma + p.valor, 0);

export const todosPagaram = (grupo: GrupoDePagamento) =>
  grupo.participantes.length > 0 && faltamPagar(grupo).length === 0
    && grupo.participantes.every((p) => p.estado === "pago");

/**
 * O que cada participante ve. Curto: e lido no celular, no meio do dia.
 */
export function situacaoDoParticipante(
  participante: ParticipanteDoPagamento,
  grupo: GrupoDePagamento,
) {
  if (!grupo.fechado) {
    return "O grupo ainda está aberto. Você paga depois que fecharmos.";
  }
  if (!grupo.separado) {
    return "Estamos separando as fatias. Avisamos aqui quando puder pagar.";
  }
  switch (participante.estado) {
    case "pago": return "Pagamento confirmado 💗";
    case "processando": return "Confirmando seu pagamento…";
    case "expirado": return "O prazo do link acabou — geramos outro para você.";
    default: return "Suas fatias estão separadas. Pode pagar quando quiser.";
  }
}

/**
 * O que o organizador ve. Ele acompanha, mas nao cobra — e essa a diferenca
 * que faz o Pede Junto parar de morrer.
 */
export function resumoParaOrganizador(grupo: GrupoDePagamento) {
  const pagaram = jaPagaram(grupo).length;
  const total = grupo.participantes.length;

  if (!grupo.fechado) {
    const faltam = Math.max(0, MINIMO_ENTREGA_GRATIS - grupo.totalDeFatias);
    return faltam > 0
      ? `${grupo.totalDeFatias} fatias — faltam ${faltam} para a entrega grátis.`
      : `${grupo.totalDeFatias} fatias e entrega grátis liberada. Ainda cabe mais gente.`;
  }
  if (!grupo.separado) return "A Adoce está separando. Ninguém precisa pagar ainda.";
  if (todosPagaram(grupo)) return "Todo mundo já acertou. É só buscar. 💗";
  return `${pagaram} de ${total} já pagaram. Cada um recebe o link direto — você não precisa cobrar ninguém.`;
}

/**
 * Lembrete que o organizador pode mandar. Cita so quem falta, e **nao cobra
 * dinheiro em nome da Adoce**: quem cobra e o link individual.
 */
export function lembreteDePagamento(grupo: GrupoDePagamento) {
  const faltam = faltamPagar(grupo);
  if (!faltam.length || !podeCobrar(grupo)) return "";
  const nomes = faltam.map((p) => p.nome.split(/\s+/)[0]).join(", ");
  return `Oi! As fatias do ${grupo.nome} já estão separadas. ${nomes}, o link de pagamento de vocês chegou no WhatsApp. 💗`;
}

/** Abre o WhatsApp com o lembrete pronto, para o organizador escolher o grupo. */
export const linkDeWhatsAppDoGrupo = (texto: string) =>
  `https://wa.me/?text=${encodeURIComponent(texto)}`;

/**
 * O organizador ve quem pagou, nunca como. Nem valor de cartao, nem meio,
 * nem nada que o amigo nao autorizou a compartilhar.
 */
export function listaParaOrganizador(grupo: GrupoDePagamento) {
  return grupo.participantes.map((p) => ({
    nome: p.nome,
    fatias: p.fatias,
    pagou: p.estado === "pago",
  }));
}

// ---------------------------------------------------------------------------
// A ponte com o banco que ja existe.
//
// O Pede Junto esta no ar desde 21/07 em `pede_junto_groups` e
// `pede_junto_participants` — e o participante **ja tinha** `payment_url`,
// `payment_expires_at`, `paid_at` e os status `payment_pending` e `paid`.
// Metade do pagamento individual ja estava construida e parada.
//
// Nada aqui inventa tabela nova. Isto so traduz o que o banco diz para o que
// a tela precisa mostrar.

/** Status do grupo, como o banco escreve. */
export type StatusDoGrupo =
  | "open" | "submitted" | "confirmed" | "awaiting_payment"
  | "preparing" | "ready" | "completed" | "cancelled" | "expired";

/** Status do participante, como o banco escreve. */
export type StatusDoParticipante =
  | "active" | "payment_pending" | "paid" | "removed" | "cancelled";

/** Grupo aberto e grupo que ainda recebe gente. Fechado e todo o resto. */
export const grupoEstaFechado = (status: StatusDoGrupo) => status !== "open";

/**
 * A Adoce ja separou? So a partir de `awaiting_payment`. Antes disso o pedido
 * foi enviado, mas ninguem conferiu se ha fatia para todo mundo — e cobrar
 * antes de conferir e cobrar pelo que talvez nao exista.
 */
export const adoceJaSeparou = (status: StatusDoGrupo) =>
  ["awaiting_payment", "preparing", "ready", "completed"].includes(status);

export function estadoDoParticipante(
  status: StatusDoParticipante,
  expiraEm: string | null,
  agora = new Date(),
): EstadoDoPagamento {
  if (status === "paid") return "pago";
  if (status !== "payment_pending") return "aguardando_fechamento";
  if (expiraEm && new Date(expiraEm) < agora) return "expirado";
  return "a_pagar";
}

export type LinhaDoGrupo = {
  name: string;
  status: StatusDoGrupo;
  minimum_slices: number;
  free_delivery_unlocked_at: string | null;
};

export type LinhaDoParticipante = {
  id: string;
  name: string;
  status: StatusDoParticipante;
  payment_url: string | null;
  payment_expires_at: string | null;
  fatias: number;
  valor_centavos: number;
};

/** Traduz as linhas do banco para o que a tela desenha. */
export function montarGrupo(
  grupo: LinhaDoGrupo,
  participantes: LinhaDoParticipante[],
  agora = new Date(),
): GrupoDePagamento {
  // Quem saiu do grupo nao aparece nem conta.
  const ativos = participantes.filter(
    (p) => p.status !== "removed" && p.status !== "cancelled",
  );
  const totalDeFatias = ativos.reduce((soma, p) => soma + p.fatias, 0);

  return {
    nome: grupo.name,
    totalDeFatias,
    entregaGratis: Boolean(grupo.free_delivery_unlocked_at)
      || totalDeFatias >= (grupo.minimum_slices || MINIMO_ENTREGA_GRATIS),
    fechado: grupoEstaFechado(grupo.status),
    separado: adoceJaSeparou(grupo.status),
    participantes: ativos.map((p) => ({
      id: p.id,
      nome: p.name,
      fatias: p.fatias,
      valor: p.valor_centavos / 100,
      estado: estadoDoParticipante(p.status, p.payment_expires_at, agora),
      linkDePagamento: p.payment_url,
      expiraEm: p.payment_expires_at,
    })),
  };
}

export function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(valor)
    .replace(/[\u00A0\u202F\u2007]/g, " ");
}
