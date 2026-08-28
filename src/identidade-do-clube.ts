// Quem e o cliente, e o que mostrar para ele.
//
// O problema que isto resolve, relatado pelo Rubens em 10/08 testando a
// homologacao: a home reconhece o membro e mostra "6 de 14", mas ao tocar no
// perfil o site manda cadastrar de novo. O cadastro duplicado e permitido, o
// codigo por e-mail nao bate com o que o Supabase envia — ele manda Magic Link
// e a tela pede seis digitos — e o Magic Link volta com o token na URL sem
// abrir sessao. O cliente roda em circulo e nenhuma porta abre.
//
// A causa nao e nenhuma dessas telas. E que existem tres caminhos de
// identidade convivendo — WhatsApp, e-mail e passkey — e nenhum completa
// sozinho. Enquanto forem tres, sempre havera um que nao fecha.
//
// Aqui existe um caminho so. Esta funcao e a unica que decide, e todas as telas
// obedecem a ela. Se o site reconhece a pessoa de qualquer forma, ele NUNCA
// pede cadastro.

export type Reconhecimento = {
  /** Sessao de verdade no Supabase. */
  sessao: boolean;
  /** Token do cartao, que chega pelo QR impresso na sacola: #cartao/<token>. */
  tokenDoCartao: string | null;
  /** Resumo ja carregado do Clube, quando houver. */
  membro: { primeiroNome: string; carimbos: number } | null;
  /** Token solto na URL depois de um Magic Link, que ninguem aproveitou. */
  tokenNaUrl: string | null;
};

export type Porta =
  | "cartao"           // mostra o cartao do Clube
  | "abrindo"          // esta trocando o token por sessao
  | "convite"          // nao conhece: convida a conhecer o Clube
  | "conflito";        // conhece pelo telefone, mas nao tem como abrir agora

export type Decisao = {
  porta: Porta;
  /** O que a tela diz. Curto, sem jargao. */
  titulo: string;
  mensagem: string;
  /** Rotulo do botao principal, quando houver. */
  acao?: string;
};

/**
 * A regra de ouro, e a unica que precisa ser lembrada:
 *
 *   se o site sabe quem e a pessoa, ele nao pede cadastro.
 *
 * Foi quebra-la que criou o loop.
 */
export function decidirPorta(r: Reconhecimento): Decisao {
  // 1. Token solto na URL vindo do Magic Link: trocar por sessao antes de
  //    qualquer outra coisa. Hoje ele e ignorado e o cliente volta ao inicio.
  if (r.tokenNaUrl && !r.sessao) {
    return {
      porta: "abrindo",
      titulo: "Abrindo seu cartão…",
      mensagem: "Só um instante.",
    };
  }

  // 2. Sessao de verdade: o cartao abre. Sem pergunta, sem cadastro.
  if (r.sessao) {
    return {
      porta: "cartao",
      titulo: r.membro ? `Olá, ${r.membro.primeiroNome}` : "Seu cartão",
      mensagem: "",
    };
  }

  // 3. QR impresso na sacola. Nao exige senha, nao exige e-mail, nao exige
  //    nada — e o unico caminho que funciona para quem esta sem dado movel,
  //    porque o papel ja esta na mao dele.
  if (r.tokenDoCartao) {
    return {
      porta: "cartao",
      titulo: r.membro ? `Olá, ${r.membro.primeiroNome}` : "Seu cartão",
      mensagem: "",
    };
  }

  // 4. A home reconheceu o membro (pelo telefone do ultimo pedido, por
  //    exemplo) mas nao ha como abrir a conta agora. Nunca mandar cadastrar:
  //    a pessoa JA existe, e cadastrar de novo perde os carimbos dela.
  if (r.membro) {
    return {
      porta: "conflito",
      titulo: `Olá, ${r.membro.primeiroNome}`,
      mensagem:
        `Você já tem ${r.membro.carimbos} ${r.membro.carimbos === 1 ? "carimbo" : "carimbos"} no Clube. ` +
        "Mostre seu nome no balcão que a gente abre seu cartão para você.",
      acao: "Falar com a Adoce",
    };
  }

  // 5. Ninguem conhecido. So aqui se convida.
  return {
    porta: "convite",
    titulo: "Clube Adoce",
    mensagem:
      "A cada fatia, um carimbo. Complete 14 e a 15ª é por nossa conta. " +
      "O cadastro é feito por nós no balcão, em dez segundos.",
    acao: "Como participar",
  };
}

/** Nunca oferecer cadastro a quem o site ja conhece. */
export const podeOferecerCadastro = (r: Reconhecimento) =>
  decidirPorta(r).porta === "convite";

/**
 * Le o token que o Supabase devolve depois do Magic Link.
 *
 * Ele vem no fragmento: /#access_token=...&refresh_token=...
 * Hoje ninguem le, e o cliente volta a home como se nada tivesse acontecido.
 */
export function tokenDoMagicLink(hash = ""): string | null {
  const limpo = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!limpo.includes("access_token")) return null;
  const params = new URLSearchParams(limpo);
  return params.get("access_token");
}

/** recovery | magiclink | signup | null — vem no mesmo fragmento do Supabase. */
export function tipoDoLinkDeAcesso(hash = ""): string | null {
  const limpo = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!limpo.includes("access_token")) return null;
  return new URLSearchParams(limpo).get("type");
}

/** Token do cartao impresso: #cartao/<token>. */
export function tokenDoCartaoNaRota(hash = ""): string | null {
  const m = hash.match(/^#cartao\/([A-Za-z0-9._-]{8,})$/);
  return m ? m[1] : null;
}

/**
 * Depois de aproveitar o token, a URL precisa ser limpa — senao ele fica
 * gravado no historico do navegador e na analise de uso. Ja aconteceu: havia
 * 7 registros com o token completo do cliente em site_analytics_events.
 */
export const rotaLimpaDepoisDoLogin = "#clube";
