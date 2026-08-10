// O acompanhamento do pedido, pelo lado do cliente.
//
// Em 08/08 a Juliana Vidal reservou as 10h52 e ficou sem saber se valia. O
// pedido estava certo no banco desde o primeiro segundo; o que faltava era ela
// poder ver.
//
// A esteira em `jornada-do-pedido.ts` ja descreve as etapas para a operacao.
// Aqui e a mesma esteira contada para quem espera — com uma diferenca de tom
// que importa: a operacao precisa saber o que fazer, o cliente precisa saber
// o que esperar.

import { ESTEIRA, JORNADA, encerrado, podeCobrar, type Etapa, type Pedido } from "./jornada-do-pedido";

export type VistaDoCliente = {
  etapa: Etapa;
  passo: number;
  /** Quantas etapas a esteira tem, para desenhar a barra. */
  passos: number;
  titulo: string;
  agora: string;
  /** O que vem depois. Vazio quando acabou. */
  aSeguir: string;
  /** Verdadeiro quando a Adoce ja pode receber o pagamento. */
  esperandoPagamento: boolean;
};

const A_SEGUIR: Partial<Record<Etapa, string>> = {
  awaiting_confirmation: "Assim que conferirmos tudo, confirmamos por aqui.",
  reserved: "Vamos separar suas fatias antes do horário combinado.",
  preparing: "Avisamos assim que estiver tudo embalado.",
  awaiting_payment: "Depois do pagamento, é só vir buscar.",
  paid: "Avisamos assim que estiver liberado para retirada.",
  ready: "Estamos esperando você. 💗",
};

export function vistaDoCliente(pedido: Pedido): VistaDoCliente {
  const definicao = JORNADA[pedido.etapa];
  const visiveis = ESTEIRA.filter((e) => e !== "completed");
  return {
    etapa: pedido.etapa,
    passo: definicao.passo ?? 0,
    passos: visiveis.length,
    titulo: definicao.cliente,
    agora: definicao.resumo,
    aSeguir: encerrado(pedido.etapa) ? "" : A_SEGUIR[pedido.etapa] || "",
    esperandoPagamento: podeCobrar(pedido),
  };
}

/** As etapas que aparecem na linha do tempo do cliente. */
export function etapasVisiveis() {
  return ESTEIRA.filter((e) => e !== "completed").map((etapa) => ({
    etapa,
    nome: JORNADA[etapa].cliente,
    passo: JORNADA[etapa].passo ?? 0,
  }));
}

export type EstadoDoPasso = "feito" | "agora" | "futuro";

export function estadoDoPasso(passo: number, atual: number): EstadoDoPasso {
  if (passo < atual) return "feito";
  if (passo === atual) return "agora";
  return "futuro";
}

/**
 * Quanto tempo falta para o horario combinado, em palavra de gente.
 * Passou da hora, nao acusa atraso do cliente: apenas convida.
 */
export function faltaParaRetirada(retiradaEm: string | null, agoraMs = Date.now()) {
  if (!retiradaEm) return "";
  const alvo = new Date(retiradaEm).getTime();
  if (!Number.isFinite(alvo)) return "";
  const minutos = Math.round((alvo - agoraMs) / 60000);
  if (minutos <= 0) return "Já pode vir buscar.";
  if (minutos < 60) return `Falta cerca de ${minutos} min.`;
  const horas = Math.floor(minutos / 60);
  return horas === 1 ? "Falta cerca de 1 hora." : `Faltam cerca de ${horas} horas.`;
}

/**
 * Cancelado e expirado nao sao a mesma coisa, e o cliente merece saber a
 * diferenca — um foi decisao, o outro foi prazo.
 */
export function encerramento(etapa: Etapa) {
  if (etapa === "completed") return "Pedido retirado. Obrigado! 💗";
  if (etapa === "cancelled") return "Este pedido foi cancelado.";
  if (etapa === "expired") return "O prazo deste pedido terminou.";
  return "";
}
