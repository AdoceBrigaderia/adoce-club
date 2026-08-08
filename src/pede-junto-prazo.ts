// O prazo do Pede Junto.
//
// O Rubens descreveu o problema com precisao: "tem que haver um limite de tempo
// para todos fecharem". Sem prazo, o grupo fica aberto para sempre, o
// organizador vira cobrador e as pessoas desistem — que e, hoje, o maior
// gargalo de venda identificado.
//
// Este arquivo cuida so da contagem e do que dizer em cada momento. Nao busca
// nada, nao desenha nada, nao decide sozinho: quem encerra o grupo e o banco,
// pelo campo closes_at. Aqui a gente apenas traduz o tempo em palavra.
//
// A regra de tom vale igual: a mensagem explica o porque e nunca apressa com
// medo. "Falta pouco" convida. "Corre que vai acabar" assusta.

import type { PedeJuntoParticipant, PedeJuntoRoom } from "./pede-junto";

export type Urgencia = "tranquilo" | "atencao" | "ultima_chamada" | "encerrado";

export type Prazo = {
  urgencia: Urgencia;
  restaMs: number;
  /** Rotulo curto do relogio: "2h14", "18 min", "encerrado". */
  relogio: string;
  /** Frase completa mostrada ao grupo. */
  frase: string;
};

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** Abaixo disto o grupo entra em ultima chamada. */
const ULTIMA_CHAMADA = 30 * MINUTO;
/** Abaixo disto vale chamar atencao, sem alarme. */
const ATENCAO = 2 * HORA;

export function tempoRestante(fechaEm: string, agora = Date.now()) {
  const alvo = new Date(fechaEm).getTime();
  if (!Number.isFinite(alvo)) return 0;
  return Math.max(0, alvo - agora);
}

export function relogioDe(restaMs: number) {
  if (restaMs <= 0) return "encerrado";
  if (restaMs >= DIA) {
    const dias = Math.floor(restaMs / DIA);
    return `${dias} ${dias === 1 ? "dia" : "dias"}`;
  }
  if (restaMs >= HORA) {
    const horas = Math.floor(restaMs / HORA);
    const minutos = Math.floor((restaMs % HORA) / MINUTO);
    return minutos ? `${horas}h${String(minutos).padStart(2, "0")}` : `${horas}h`;
  }
  const minutos = Math.max(1, Math.floor(restaMs / MINUTO));
  return `${minutos} min`;
}

export function urgenciaDe(restaMs: number): Urgencia {
  if (restaMs <= 0) return "encerrado";
  if (restaMs <= ULTIMA_CHAMADA) return "ultima_chamada";
  if (restaMs <= ATENCAO) return "atencao";
  return "tranquilo";
}

/**
 * Quem entrou no grupo mas ainda nao escolheu nenhuma fatia.
 *
 * E a informacao que o organizador mais precisa: em vez de cobrar todo mundo,
 * ele cobra so quem falta. Participante removido ou cancelado nao conta.
 */
export function quemAindaNaoEscolheu(participantes: PedeJuntoParticipant[]) {
  return participantes.filter(
    (p) =>
      p.status !== "removed" &&
      p.status !== "cancelled" &&
      !p.items.some((item) => item.status !== "cancelled" && item.quantity > 0),
  );
}

function listar(nomes: string[]) {
  if (nomes.length === 0) return "";
  if (nomes.length === 1) return nomes[0];
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export function prazoDoGrupo(room: PedeJuntoRoom, agora = Date.now()): Prazo {
  const restaMs = tempoRestante(room.closes_at, agora);
  const urgencia = room.status === "open" ? urgenciaDe(restaMs) : "encerrado";
  const relogio = relogioDe(restaMs);

  if (urgencia === "encerrado") {
    return {
      urgencia,
      restaMs: 0,
      relogio: "encerrado",
      frase: "O grupo foi fechado. A Adoce já está cuidando do pedido.",
    };
  }

  const faltam = quemAindaNaoEscolheu(room.participants);
  const nomes = listar(faltam.map((p) => p.name.split(/\s+/)[0]).filter(Boolean));

  if (urgencia === "ultima_chamada") {
    return {
      urgencia,
      restaMs,
      relogio,
      frase: faltam.length
        ? `Últimos ${relogio} para ${nomes} escolherem.`
        : `Últimos ${relogio}. Todo mundo já escolheu — pode fechar quando quiser.`,
    };
  }

  if (urgencia === "atencao") {
    return {
      urgencia,
      restaMs,
      relogio,
      frase: faltam.length
        ? `Faltam ${relogio} e ${nomes} ainda não escolheram.`
        : `Faltam ${relogio} e todo mundo já escolheu.`,
    };
  }

  return {
    urgencia,
    restaMs,
    relogio,
    frase: faltam.length
      ? `O grupo fica aberto por mais ${relogio}. ${nomes} ainda não escolheram.`
      : `O grupo fica aberto por mais ${relogio}. Ainda cabe mais gente.`,
  };
}

/**
 * Mensagem pronta para o organizador cutucar quem falta pelo WhatsApp.
 *
 * Sem link: o cliente que nao tem internet nao consegue abrir, e pedir isso a
 * ele o constrange. Quem quiser o convite ja o recebeu antes.
 */
export function lembreteDeQuemFalta(room: PedeJuntoRoom, agora = Date.now()) {
  const faltam = quemAindaNaoEscolheu(room.participants);
  if (!faltam.length) return "";
  const prazo = prazoDoGrupo(room, agora);
  const nomes = listar(faltam.map((p) => p.name.split(/\s+/)[0]).filter(Boolean));
  return [
    `Oi! O ${room.name} fecha em ${prazo.relogio}.`,
    `${nomes}, faltam vocês escolherem a fatia. 💗`,
  ].join(" ");
}

/** Quanto tempo falta para a proxima virada de rotulo, para nao atualizar a tela a toa. */
export function proximaAtualizacaoMs(restaMs: number) {
  if (restaMs <= 0) return 0;
  if (restaMs > HORA) return MINUTO;
  return 15_000;
}

