// Compartilhe Docura — o cartao de indicacoes.
//
// O Rubens descreveu assim: cada amigo que prova pela primeira vez vira um
// coracao na cartela. Sao 12 posicoes, decisao dele — nao 14 nem 5.
//
// Ja existem 85 codigos de convite no banco, um para quase cada cliente. Nunca
// foram usados porque nao havia tela.
//
// A decisao de projeto que manda aqui: **o convite tem que funcionar sem o
// amigo abrir nada.** Boa parte dos clientes so tem WhatsApp e Instagram
// gratuitos no plano; abrir link custa dado pago, e pedir isso constrange quem
// esta sem. Entao o caminho principal e o amigo **dizer o codigo no balcao**.
// O link existe, mas e o segundo caminho, nao o primeiro.

export const POSICOES = 12;

export type Indicacao = {
  nome: string;
  /** "convidado" ainda nao veio · "confirmado" ja provou. */
  status: "convidado" | "confirmado";
  quando: string | null;
};

export type CartaoDeIndicacao = {
  codigo: string;
  primeiroNome: string;
  indicacoes: Indicacao[];
};

export const confirmadas = (cartao: CartaoDeIndicacao) =>
  cartao.indicacoes.filter((i) => i.status === "confirmado");

export const aguardando = (cartao: CartaoDeIndicacao) =>
  cartao.indicacoes.filter((i) => i.status === "convidado");

export const carimbosNaCartela = (cartao: CartaoDeIndicacao) =>
  confirmadas(cartao).length % POSICOES;

export const cartelasCompletas = (cartao: CartaoDeIndicacao) =>
  Math.floor(confirmadas(cartao).length / POSICOES);

export function faltamPara(cartao: CartaoDeIndicacao) {
  return POSICOES - carimbosNaCartela(cartao);
}

/**
 * A frase de progresso. Comeca convidando, nunca cobrando — quem ainda nao
 * indicou ninguem nao fez nada de errado.
 */
export function progresso(cartao: CartaoDeIndicacao) {
  const feitos = carimbosNaCartela(cartao);
  const completas = cartelasCompletas(cartao);

  if (completas > 0 && feitos === 0) {
    return completas === 1
      ? "Você completou uma cartela inteira de indicações. 💗"
      : `Você já completou ${completas} cartelas de indicações. 💗`;
  }
  if (feitos === 0) {
    return "Cada amigo que provar pela primeira vez vira um coração aqui.";
  }
  const faltam = faltamPara(cartao);
  if (faltam === 1) return "Falta só um amigo para completar a cartela.";
  return `${feitos} de ${POSICOES} · faltam ${faltam} para completar.`;
}

/** WhatsApp oficial da Adoce, so digitos. */
export const ZAP_DA_ADOCE = "5585982156026";

/**
 * O link que o amigo vai tocar. Ele NAO leva ao site: leva direto a conversa
 * com a Adoce, com o codigo ja escrito na mensagem.
 *
 * Ideia do Rubens em 10/08, e ela e melhor que a anterior. Eu tinha evitado
 * link por causa do dado movel — mas link de WhatsApp nao e link de site: abre
 * o aplicativo, que e exatamente o que o plano dessas pessoas da de graca.
 *
 * E o amigo entra pela porta certa: a caixa de entrada da Adoce, onde uma
 * automacao pode responder na hora, em vez de depender de lembrar um codigo
 * no balcao.
 */
export function linkDoConvite(cartao: CartaoDeIndicacao, zap = ZAP_DA_ADOCE) {
  const texto = [
    `Oi! A/o ${cartao.primeiroNome} me indicou a Adoce.`,
    `Meu código de convite é ${cartao.codigo}.`,
    "Queria saber os sabores de hoje. 🍰",
  ].join("\n");
  return `https://wa.me/${zap}?text=${encodeURIComponent(texto)}`;
}

/**
 * A mensagem que o cliente encaminha para o amigo, com o link acima dentro.
 *
 * O codigo aparece escrito tambem: se o link nao abrir por qualquer motivo, o
 * amigo ainda consegue dizer no balcao. Um caminho nao anula o outro.
 */
export function convitePorMensagem(cartao: CartaoDeIndicacao, zap = ZAP_DA_ADOCE) {
  return [
    "Oi! Fui na Adoce Brigaderia e as fatias são muito boas. 🍰",
    "",
    `Toca aqui que já cai no WhatsApp deles: ${linkDoConvite(cartao, zap)}`,
    "",
    `Se preferir, é só falar no balcão que a/o ${cartao.primeiroNome} indicou — o código é ${cartao.codigo}.`,
    "",
    "Ficam no Cantinho da Adoce, na Av. da Saudade, a partir das 18h. 💗",
  ].join("\n");
}

/** Abre o compartilhar do WhatsApp com o convite pronto. */
export function linkDeWhatsApp(cartao: CartaoDeIndicacao, zap = ZAP_DA_ADOCE) {
  return `https://wa.me/?text=${encodeURIComponent(convitePorMensagem(cartao, zap))}`;
}

/**
 * O que dizer sobre cada indicacao na lista. Nome so, sem telefone: quem
 * indicou nao precisa ver o dado do amigo, e o amigo nao autorizou isso.
 */
export function legendaDaIndicacao(indicacao: Indicacao) {
  if (indicacao.status === "confirmado") return "já provou 💗";
  return "ainda não veio";
}

/** Inclinacao do carimbo: carimbo de mao nunca sai reto duas vezes igual. */
export const INCLINACAO = [-9, 6, -4, 11, -7, 5, -12, 8, -3, 10, -6, 7];
