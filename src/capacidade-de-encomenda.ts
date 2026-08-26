// Capacidade de encomenda da Adoce.
//
// Este arquivo responde uma pergunta so, e responde com honestidade:
// "da para aceitar esta encomenda para este dia?"
//
// Ele existe porque hoje ninguem sabe responder isso sem abrir tres telas e
// contar na cabeca. E porque aceitar uma encomenda que nao cabe e pior do que
// recusar: quebra a promessa depois de feita.
//
// As regras vieram do Rubens, palavra por palavra:
//
//   "encomendas de tortas ate 5 por dia / docinhos 300 por dia"
//   "as 5 que eu falei que pode entrar, ja esta contando com as que nos
//    produzimos pro festival"
//   "nao vai atrapalhar se for pedido com antecendendia de pelo menos 3 dias
//    uteis"
//   "o dia que tiver reserva de Adoce na escola, nao pode ter mais nenhuma
//    outra coisa agendado"
//
// Producao fixa do festival, ja embutida no teto de 5:
//   terca 3 · quarta 3 · quinta 6 · sexta 8 · sabado 8 = 28 por semana

export const TETO_TORTAS_DIA = 5;
export const TETO_DOCINHOS_DIA = 300;
export const ANTECEDENCIA_DIAS_UTEIS = 3;

/** Domingo = 0. Producao do festival por dia da semana. */
export const FESTIVAL_POR_DIA = [0, 0, 3, 3, 6, 8, 8];

export type Agenda = {
  /** Tortas de encomenda ja aceitas para o dia. */
  tortasAgendadas: number;
  /** Docinhos ja aceitos para o dia. */
  docinhosAgendados: number;
  /** Adoce na Escola bloqueia o dia inteiro. */
  escolaReservada: boolean;
  /** Dia fechado por decisao da Adoce: feriado, manutencao, descanso. */
  bloqueado?: boolean;
};

export type Pedido = {
  tortas: number;
  docinhos: number;
};

export type Veredito = {
  cabe: boolean;
  /** Precisa de olho humano antes de confirmar. */
  exigeAvaliacao: boolean;
  motivos: string[];
  /** Quanto ainda cabe no dia depois deste pedido, se couber. */
  restam: { tortas: number; docinhos: number };
};

const DIA_MS = 86_400_000;

const soData = (data: Date) =>
  new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));

export function ehDiaUtil(data: Date) {
  const dia = data.getUTCDay();
  return dia >= 1 && dia <= 5;
}

/**
 * Dias uteis entre hoje e a data desejada, sem contar hoje.
 *
 * Feriado nao entra na conta: a Adoce nao mantem calendario de feriados, e
 * inventar um seria pior do que nao ter. Sexta e sabado ja caem em avaliacao
 * humana por outro motivo.
 */
export function diasUteisAte(desejada: Date, hoje: Date) {
  const inicio = soData(hoje).getTime();
  const fim = soData(desejada).getTime();
  if (fim <= inicio) return 0;
  let uteis = 0;
  for (let t = inicio + DIA_MS; t <= fim; t += DIA_MS) {
    if (ehDiaUtil(new Date(t))) uteis += 1;
  }
  return uteis;
}

/** Quantas tortas do festival ja ocupam o teto naquele dia da semana. */
export function tortasDoFestival(data: Date) {
  return FESTIVAL_POR_DIA[data.getUTCDay()] ?? 0;
}

/**
 * O teto de 5 ja considera o festival. Entao o que sobra para encomenda e
 * 5 menos o que o festival ocupa, menos o que ja foi aceito.
 */
export function tortasDisponiveis(data: Date, agenda: Agenda) {
  const ocupado = Math.min(TETO_TORTAS_DIA, tortasDoFestival(data)) + agenda.tortasAgendadas;
  return Math.max(0, TETO_TORTAS_DIA - ocupado);
}

export function docinhosDisponiveis(agenda: Agenda) {
  return Math.max(0, TETO_DOCINHOS_DIA - agenda.docinhosAgendados);
}

export function avaliarEncomenda(
  pedido: Pedido,
  data: Date,
  agenda: Agenda,
  hoje = new Date(),
): Veredito {
  const motivos: string[] = [];
  let cabe = true;
  let exigeAvaliacao = false;

  const tortasLivres = tortasDisponiveis(data, agenda);
  const docinhosLivres = docinhosDisponiveis(agenda);

  if (agenda.bloqueado) {
    cabe = false;
    motivos.push("A Adoce não está atendendo encomendas neste dia.");
  }

  // Adoce na Escola toma o dia inteiro. Nao e limite, e exclusividade.
  if (agenda.escolaReservada) {
    cabe = false;
    motivos.push("Este dia já está reservado para a Adoce na Escola.");
  }

  if (pedido.tortas > 0 && pedido.tortas > tortasLivres) {
    cabe = false;
    motivos.push(
      tortasLivres === 0
        ? "Não há torta disponível para encomenda neste dia."
        : `Cabem ${tortasLivres} ${tortasLivres === 1 ? "torta" : "tortas"} neste dia, e o pedido tem ${pedido.tortas}.`,
    );
  }

  if (pedido.docinhos > 0 && pedido.docinhos > docinhosLivres) {
    cabe = false;
    motivos.push(
      docinhosLivres === 0
        ? "Os docinhos deste dia já estão todos comprometidos."
        : `Cabem ${docinhosLivres} docinhos neste dia, e o pedido tem ${pedido.docinhos}.`,
    );
  }

  const uteis = diasUteisAte(data, hoje);
  if (uteis < ANTECEDENCIA_DIAS_UTEIS) {
    exigeAvaliacao = true;
    motivos.push(
      uteis === 0
        ? "Para hoje ou amanhã, precisa de avaliação da Adoce."
        : `São ${uteis} ${uteis === 1 ? "dia útil" : "dias úteis"} de antecedência; o combinado são ${ANTECEDENCIA_DIAS_UTEIS}.`,
    );
  }

  // Sexta e sabado sao os dias cheios do Cantinho. Cabem, mas com olho humano.
  const diaSemana = data.getUTCDay();
  if (cabe && (diaSemana === 5 || diaSemana === 6)) {
    exigeAvaliacao = true;
    motivos.push(
      `${diaSemana === 5 ? "Sexta" : "Sábado"} é dia cheio do Cantinho — vale conferir antes de confirmar.`,
    );
  }

  return {
    cabe,
    exigeAvaliacao: cabe && exigeAvaliacao,
    motivos,
    restam: {
      tortas: cabe ? Math.max(0, tortasLivres - pedido.tortas) : tortasLivres,
      docinhos: cabe ? Math.max(0, docinhosLivres - pedido.docinhos) : docinhosLivres,
    },
  };
}

/**
 * Frase para o cliente. Nunca diz "não" seco: quando não cabe, oferece
 * caminho. Recusa sem alternativa e venda perdida de graça.
 */
export function respostaAoCliente(veredito: Veredito, proximaData?: string) {
  if (veredito.cabe && !veredito.exigeAvaliacao) {
    return "Conseguimos sim! Já podemos confirmar essa data. 💗";
  }
  if (veredito.cabe) {
    return "Essa data é possível, mas precisamos confirmar com você — respondemos ainda hoje. 💗";
  }
  const alternativa = proximaData
    ? ` A data mais próxima que conseguimos é ${proximaData}.`
    : " Podemos ver juntos uma data próxima?";
  return `Nessa data já estamos com a produção comprometida.${alternativa} 💗`;
}

/**
 * Primeira data que aceita o pedido, olhando para a frente.
 *
 * Devolver "não" sem oferecer o próximo dia possível é o que faz o cliente
 * procurar outra confeitaria.
 */
export function proximaDataPossivel(
  pedido: Pedido,
  aPartirDe: Date,
  agendaDe: (data: Date) => Agenda,
  hoje = new Date(),
  limiteDias = 60,
) {
  for (let i = 0; i <= limiteDias; i += 1) {
    const data = new Date(soData(aPartirDe).getTime() + i * DIA_MS);
    const veredito = avaliarEncomenda(pedido, data, agendaDe(data), hoje);
    if (veredito.cabe && !veredito.exigeAvaliacao) return data;
  }
  return null;
}
