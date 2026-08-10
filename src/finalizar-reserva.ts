// A finalizacao da reserva — o ultimo passo do Adoce Hoje.
//
// Aqui vale a regra que o Rubens repetiu mais de uma vez:
//
//   "eu quero algo que diminua a quantidade de cliques que o cliente precisa
//    dar para interagir conosco, isso inclui tambem nao ser obrigado a
//    compartilhar algum dado dele que a gente nao tem necessidade de saber"
//
// Entao sao dois campos: nome e WhatsApp. Nada de e-mail, CPF, endereco ou
// senha. O endereco nao entra porque a Adoce nao entrega — o cliente retira.
//
// E a outra regra, que muda o desenho inteiro:
//
//   "o cliente so deve realizar o pagamento depois que a gente confirme que
//    aquele produto foi reservado ou separado pra ele"
//
// Por isso esta tela **nao cobra**. Ela reserva. O pagamento vem depois, com a
// Adoce confirmando.

import { validar as validarCadastro, mascaraTelefone, telefoneE164, arrumarNome } from "./cadastro-rapido";
import type { Item, Sabor } from "./escolha-de-fatias";
import { dinheiro, resumoDoPedido, total, totalDeFatias } from "./escolha-de-fatias";

export type Reserva = {
  nome: string;
  telefone: string;
  /** Horario combinado de retirada, no formato HH:MM. */
  horario: string;
  observacao: string;
};

export type Problema = { campo: keyof Reserva; texto: string };

/**
 * O cliente ja identificado nao digita nada. A tela so confirma quem e —
 * um toque em vez de dois campos.
 */
export type ClienteConhecido = { nome: string; telefone: string; presentes: number };

export function validar(reserva: Reserva, horariosPermitidos: string[]): Problema[] {
  const problemas: Problema[] = [];

  for (const p of validarCadastro({ nome: reserva.nome, telefone: reserva.telefone })) {
    problemas.push({ campo: p.campo, texto: p.texto });
  }

  if (!reserva.horario) {
    problemas.push({ campo: "horario", texto: "Escolha um horário para retirar." });
  } else if (horariosPermitidos.length && !horariosPermitidos.includes(reserva.horario)) {
    problemas.push({ campo: "horario", texto: "Nesse horário a loja está fechada." });
  }

  // Observacao e opcional de proposito. Campo obrigatorio que ninguem le
  // e clique a mais.
  if (reserva.observacao.length > 280) {
    problemas.push({ campo: "observacao", texto: "Deixe a observação mais curta." });
  }

  return problemas;
}

export const podeReservar = (reserva: Reserva, horarios: string[]) =>
  validar(reserva, horarios).length === 0;

/**
 * Gera os horarios de retirada de meia em meia hora dentro da janela do dia.
 * Lista curta: o cliente escolhe tocando, sem teclado e sem relogio.
 */
export function horariosDisponiveis(aPartirDe: string, ate: string, passoMinutos = 30) {
  const minutos = (h: string) => {
    const [a, b] = h.split(":").map(Number);
    return a * 60 + (b || 0);
  };
  const formatar = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  const inicio = minutos(aPartirDe);
  const fim = minutos(ate);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) return [];

  const lista: string[] = [];
  for (let m = inicio; m <= fim; m += passoMinutos) lista.push(formatar(m));
  return lista;
}

export const horaAmigavel = (hhmm: string) => hhmm.replace(":", "h").replace(/h00$/, "h");

export function paraEnvio(reserva: Reserva, itens: Item[]) {
  return {
    nome: arrumarNome(reserva.nome),
    telefone: telefoneE164(reserva.telefone),
    horario: reserva.horario,
    observacao: reserva.observacao.trim(),
    itens: itens.map((i) => ({
      saborId: i.saborId,
      caldas: i.caldas,
      presentes: i.presentes,
    })),
  };
}

/**
 * A mensagem que o cliente recebe depois de reservar.
 *
 * Tom da casa: cordial, explica o porque, fecha com coracao. E nunca promete o
 * que ainda nao aconteceu — reservado nao e separado.
 */
export function mensagemDaReserva(
  reserva: Reserva,
  itens: Item[],
  sabores: Sabor[],
  local: string,
) {
  const primeiro = arrumarNome(reserva.nome).split(" ")[0];
  const linhas = resumoDoPedido(itens, sabores).map((r) => {
    const caldas = r.caldas.map((c) => `${c.quantas > 1 ? `${c.quantas}× ` : ""}${c.nome.toLowerCase()}`).join(", ");
    const presente = r.presentes ? ` 🎁 ${r.presentes === 1 ? "uma é presente" : `${r.presentes} são presente`}` : "";
    return `${r.quantidade} ${r.quantidade === 1 ? "fatia" : "fatias"} de ${r.sabor} · ${caldas}${presente}`;
  });

  return [
    `${primeiro}, recebemos sua reserva! 💗`,
    "",
    ...linhas,
    "",
    `Total: ${dinheiro(total(itens, sabores))}`,
    reserva.observacao ? `Observação: ${reserva.observacao}` : "",
    "",
    `Guardamos no seu nome para retirar às ${horaAmigavel(reserva.horario)}, no ${local}.`,
    "",
    "Assim que separarmos tudo, a gente avisa por aqui — o pagamento é só depois disso.",
  ].filter(Boolean).join("\n");
}

/** Resumo curto para a tela, antes de confirmar. */
export function resumoCurto(itens: Item[], sabores: Sabor[]) {
  const fatias = totalDeFatias(itens);
  return `${fatias} ${fatias === 1 ? "fatia" : "fatias"} · ${dinheiro(total(itens, sabores))}`;
}

export { mascaraTelefone };
