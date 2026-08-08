// A jornada do pedido, da reserva ate a retirada.
//
// Em 07/08 a Juliana Sousa pediu duas fatias e ninguem respondeu. Em 08/08 a
// Juliana Vidal reservou e ficou sem saber se estava valendo. Nos dois casos o
// pedido estava certo no banco â€” o que faltava era o cliente saber em que pe
// estava.
//
// Aqui cada etapa sabe tres coisas: como ela se chama para a operacao, como ela
// se chama para o cliente, e qual mensagem o cliente recebe ao chegar nela.
//
// Duas regras do Rubens estao codificadas e testadas:
//
//   1. O cliente so paga depois que a Adoce confirma que separou. Nunca antes.
//   2. Nada e prometido antes de acontecer. "Reservado" nao e "separado", e a
//      mensagem de cada etapa diz exatamente o que ja e verdade.

export type Etapa =
  | "awaiting_confirmation"
  | "reserved"
  | "preparing"
  | "awaiting_payment"
  | "paid"
  | "ready"
  | "completed"
  | "cancelled"
  | "expired";

export type Pedido = {
  numero: string;
  cliente: string;
  telefone: string;
  etapa: Etapa;
  itens: Array<{ sabor: string; quantidade: number; calda: string | null; presente: boolean }>;
  total: number;
  /** Onde e a partir de que hora o cliente retira. */
  retirada: { local: string; aPartirDe: string } | null;
  pago: boolean;
};

type Definicao = {
  /** Ordem na esteira. Etapas finais ficam fora da linha do tempo. */
  passo: number | null;
  operacao: string;
  cliente: string;
  /** Explica ao cliente o que esta acontecendo agora. */
  resumo: string;
  /** Rotulo do botao que leva a proxima etapa. */
  avancar?: string;
  proxima?: Etapa;
};

export const JORNADA: Record<Etapa, Definicao> = {
  awaiting_confirmation: {
    passo: 1,
    operacao: "Reserva recebida",
    cliente: "Reserva recebida",
    resumo: "Recebemos seu pedido e estamos conferindo se temos tudo.",
    avancar: "Confirmar reserva",
    proxima: "reserved",
  },
  reserved: {
    passo: 2,
    operacao: "Reserva confirmada",
    cliente: "Reserva confirmada",
    resumo: "EstÃ¡ tudo disponÃ­vel e guardado no seu nome.",
    avancar: "Iniciar separaÃ§Ã£o",
    proxima: "preparing",
  },
  preparing: {
    passo: 3,
    operacao: "Em separaÃ§Ã£o",
    cliente: "Em separaÃ§Ã£o",
    resumo: "Suas fatias estÃ£o sendo embaladas agora.",
    avancar: "Marcar como separado",
    proxima: "awaiting_payment",
  },
  awaiting_payment: {
    passo: 4,
    operacao: "Separado Â· aguardando pagamento",
    cliente: "Separado",
    resumo: "EstÃ¡ tudo separado e esperando por vocÃª.",
    avancar: "Liberar para retirada",
    proxima: "ready",
  },
  paid: {
    passo: 4,
    operacao: "Pago",
    cliente: "Pagamento recebido",
    resumo: "Recebemos seu pagamento. Obrigado!",
    avancar: "Liberar para retirada",
    proxima: "ready",
  },
  ready: {
    passo: 5,
    operacao: "Liberado para retirada",
    cliente: "Pronto para retirar",
    resumo: "Pode vir buscar quando quiser.",
    avancar: "Marcar como retirado",
    proxima: "completed",
  },
  completed: {
    passo: 6,
    operacao: "Retirado",
    cliente: "Retirado",
    resumo: "Pedido entregue. Obrigado pela preferÃªncia!",
  },
  cancelled: {
    passo: null,
    operacao: "Cancelado",
    cliente: "Cancelado",
    resumo: "Este pedido foi cancelado.",
  },
  expired: {
    passo: null,
    operacao: "Expirado",
    cliente: "Expirado",
    resumo: "O prazo deste pedido terminou.",
  },
};

export const ESTEIRA: Etapa[] = [
  "awaiting_confirmation",
  "reserved",
  "preparing",
  "awaiting_payment",
  "ready",
  "completed",
];

export const encerrado = (etapa: Etapa) =>
  etapa === "cancelled" || etapa === "expired" || etapa === "completed";

/**
 * A regra mais importante do Rubens: o cliente so paga depois que a Adoce
 * confirma que separou. Antes disso, nao se pede dinheiro.
 */
export function podeCobrar(pedido: Pedido) {
  return (
    !pedido.pago &&
    (pedido.etapa === "awaiting_payment" || pedido.etapa === "ready")
  );
}

/** Proxima etapa, ja considerando quem ja pagou. */
export function proximaEtapa(pedido: Pedido): Etapa | null {
  const definicao = JORNADA[pedido.etapa];
  if (!definicao.proxima) return null;
  // Quem ja pagou nao passa por "aguardando pagamento".
  if (definicao.proxima === "awaiting_payment" && pedido.pago) return "ready";
  return definicao.proxima;
}

export function rotuloDoAvanco(pedido: Pedido) {
  const proxima = proximaEtapa(pedido);
  if (!proxima) return null;
  if (proxima === "ready" && pedido.etapa === "preparing")
    return "Marcar como separado";
  return JORNADA[pedido.etapa].avancar || null;
}

const dinheiro = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

function listaDeItens(pedido: Pedido) {
  return pedido.itens.map((item) => {
    const calda = item.calda ? ` com ${item.calda.toLowerCase()}` : ", sem calda";
    const presente = item.presente ? " ðŸŽ sua fatia-presente" : "";
    return `${item.quantidade} ${item.quantidade === 1 ? "fatia" : "fatias"} de ${item.sabor}${calda}${presente}`;
  });
}

function ondeRetirar(pedido: Pedido) {
  if (!pedido.retirada) return "";
  return `A retirada Ã© a partir das ${pedido.retirada.aPartirDe}, no ${pedido.retirada.local}.`;
}

/**
 * Mensagem para o cliente ao entrar em cada etapa.
 *
 * Tom da casa: cordial, explica o porque, fecha com coracao. E nunca promete o
 * que ainda nao aconteceu â€” foi por isso que "ja estao separadas" saiu daqui.
 */
export function mensagemParaCliente(pedido: Pedido): string {
  const primeiroNome = pedido.cliente.split(/\s+/)[0];
  const itens = listaDeItens(pedido);
  const total = dinheiro(pedido.total);

  switch (pedido.etapa) {
    case "awaiting_confirmation":
      return [
        `${primeiroNome}, recebemos seu pedido! ðŸ’—`,
        "",
        ...itens,
        "",
        `Total: ${total}`,
        "",
        "Estamos conferindo se temos tudo e jÃ¡ confirmamos com vocÃª.",
      ].join("\n");

    case "reserved":
      return [
        `${primeiroNome}, sua reserva estÃ¡ confirmada! ðŸ’—`,
        "",
        ...itens,
        "",
        `Total: ${total}`,
        "",
        `EstÃ¡ tudo guardado no seu nome. ${ondeRetirar(pedido)}`.trim(),
      ].join("\n");

    case "preparing":
      return [
        `${primeiroNome}, comeÃ§amos a separar seu pedido. ðŸ’—`,
        "",
        ...itens,
        "",
        "Avisamos assim que estiver tudo embalado.",
      ].join("\n");

    case "awaiting_payment":
      return [
        `${primeiroNome}, seu pedido estÃ¡ separado! ðŸ’—`,
        "",
        ...itens,
        "",
        `Total: ${total}`,
        "",
        "Agora sim pode pagar com tranquilidade â€” sÃ³ pedimos o pagamento depois de garantir que estÃ¡ tudo separado para vocÃª.",
        ondeRetirar(pedido),
      ].filter(Boolean).join("\n");

    case "paid":
      return [
        `${primeiroNome}, recebemos seu pagamento. Obrigado! ðŸ’—`,
        "",
        `Total: ${total}`,
        "",
        ondeRetirar(pedido) || "Avisamos assim que estiver liberado para retirada.",
      ].join("\n");

    case "ready":
      return [
        `${primeiroNome}, seu pedido estÃ¡ pronto para retirar! ðŸ’—`,
        "",
        ...itens,
        "",
        ondeRetirar(pedido),
      ].filter(Boolean).join("\n");

    case "completed":
      return [
        `${primeiroNome}, obrigado por hoje! ðŸ’—`,
        "",
        "Esperamos que vocÃª aproveite cada pedaÃ§o. Qualquer coisa, Ã© sÃ³ chamar.",
      ].join("\n");

    case "cancelled":
      return [
        `${primeiroNome}, seu pedido foi cancelado.`,
        "",
        "Se foi engano nosso, nos avise que resolvemos na hora. ðŸ’—",
      ].join("\n");

    case "expired":
      return [
        `${primeiroNome}, o prazo do seu pedido terminou e ele foi liberado.`,
        "",
        "Se ainda quiser, Ã© sÃ³ fazer uma nova reserva â€” teremos prazer. ðŸ’—",
      ].join("\n");
  }
}

/** Link que abre a conversa no WhatsApp com o texto pronto. */
export function linkDeWhatsApp(pedido: Pedido) {
  const telefone = pedido.telefone.replace(/\D/g, "");
  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagemParaCliente(pedido))}`;
}

/**
 * O que a operacao esta devendo a este pedido, se estiver.
 *
 * Serve para o painel do dia destacar pedido parado. Silencio nao e sinal de
 * que esta tudo bem â€” foi isso que custou a Juliana Sousa.
 */
export function pendencia(pedido: Pedido, agoraMs: number, criadoEmMs: number) {
  if (encerrado(pedido.etapa)) return null;
  const minutos = Math.floor((agoraMs - criadoEmMs) / 60_000);
  if (pedido.etapa === "awaiting_confirmation" && minutos >= 15) {
    return {
      gravidade: "critico" as const,
      texto: `Sem resposta hÃ¡ ${minutos >= 60 ? `${Math.floor(minutos / 60)}h` : `${minutos} min`}.`,
    };
  }
  if (pedido.etapa === "awaiting_payment" && minutos >= 24 * 60) {
    return {
      gravidade: "atencao" as const,
      texto: "Separado hÃ¡ mais de um dia, aguardando pagamento.",
    };
  }
  return null;
}

