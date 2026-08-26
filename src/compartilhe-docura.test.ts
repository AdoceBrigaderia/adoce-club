import { describe, expect, it } from "vitest";
import {
  INCLINACAO,
  POSICOES,
  aguardando,
  carimbosNaCartela,
  cartelasCompletas,
  confirmadas,
  convitePorMensagem,
  faltamPara,
  legendaDaIndicacao,
  ZAP_DA_ADOCE,
  linkDoConvite,
  linkDeWhatsApp,
  progresso,
  type CartaoDeIndicacao,
} from "./compartilhe-docura";

function cartao(confirmados: number, convidados = 0): CartaoDeIndicacao {
  return {
    codigo: "ANNA-2285",
    primeiroNome: "Annaliza",
    indicacoes: [
      ...Array.from({ length: confirmados }, (_, i) => ({
        nome: `Amigo ${i + 1}`, status: "confirmado" as const, quando: "2026-08-01T12:00:00Z",
      })),
      ...Array.from({ length: convidados }, (_, i) => ({
        nome: `Convidado ${i + 1}`, status: "convidado" as const, quando: null,
      })),
    ],
  };
}

describe("a cartela tem 12 posições", () => {
  // Decisão do Rubens: "posso fazer é uma cartela com 12 ao invés de 14"
  it("são doze, não catorze nem cinco", () => {
    expect(POSICOES).toBe(12);
    expect(INCLINACAO).toHaveLength(12);
  });

  it("cada posição tem inclinação própria — carimbo de mão nunca sai reto", () => {
    expect(new Set(INCLINACAO).size).toBeGreaterThan(8);
    expect(INCLINACAO.every((g) => Math.abs(g) <= 15)).toBe(true);
  });
});

describe("contagem", () => {
  it("só quem provou vira carimbo", () => {
    const c = cartao(3, 5);
    expect(confirmadas(c)).toHaveLength(3);
    expect(aguardando(c)).toHaveLength(5);
    expect(carimbosNaCartela(c)).toBe(3);
  });

  it("a cartela recomeça depois de completar", () => {
    expect(carimbosNaCartela(cartao(12))).toBe(0);
    expect(cartelasCompletas(cartao(12))).toBe(1);
    expect(carimbosNaCartela(cartao(13))).toBe(1);
  });

  it("diz quanto falta", () => {
    expect(faltamPara(cartao(9))).toBe(3);
  });
});

describe("o texto convida, nunca cobra", () => {
  it("quem ainda não indicou não é repreendido", () => {
    const texto = progresso(cartao(0));
    expect(texto).toContain("Cada amigo que provar");
    expect(texto.toLowerCase()).not.toContain("você ainda não");
    expect(texto).not.toContain("0 de 12");
  });

  it("perto do fim, anima", () => {
    expect(progresso(cartao(11))).toBe("Falta só um amigo para completar a cartela.");
  });

  it("no meio, mostra a conta simples", () => {
    expect(progresso(cartao(5))).toBe("5 de 12 · faltam 7 para completar.");
  });

  it("cartela completa comemora", () => {
    expect(progresso(cartao(12))).toContain("completou uma cartela inteira");
    expect(progresso(cartao(24))).toContain("2 cartelas");
  });
});

describe("o convite cai na conversa com a Adoce, não no site", () => {
  // Ideia do Rubens: link de WhatsApp não é link de site — abre o aplicativo,
  // que é o que o plano dessas pessoas dá de graça. E o amigo entra pela porta
  // certa, onde uma automação pode responder.
  const texto = convitePorMensagem(cartao(2));

  it("o único link é para o WhatsApp da Adoce", () => {
    const links = texto.match(/https?:\/\/\S+/g) || [];
    expect(links).toHaveLength(1);
    expect(links[0]).toContain(`wa.me/${ZAP_DA_ADOCE}`);
  });

  it("não manda ninguém para o site", () => {
    expect(texto).not.toContain("adocebrigaderia.com.br");
  });

  it("o link já leva o código escrito na mensagem", () => {
    expect(decodeURIComponent(linkDoConvite(cartao(0)))).toContain("ANNA-2285");
  });

  it("o link se apresenta: diz quem indicou", () => {
    expect(decodeURIComponent(linkDoConvite(cartao(0)))).toContain("Annaliza");
  });

  it("o código também aparece escrito, caso o link não abra", () => {
    expect(texto).toContain("ANNA-2285");
    expect(texto).toContain("balcão");
  });

  it("diz quem indicou, o lugar e o horário", () => {
    expect(texto).toContain("Annaliza");
    expect(texto).toContain("Cantinho da Adoce");
    expect(texto).toContain("18h");
  });

  it("o compartilhar abre o WhatsApp com o convite pronto", () => {
    const url = linkDeWhatsApp(cartao(0));
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("ANNA-2285");
  });
});

describe("privacidade do amigo", () => {
  it("a lista mostra só o nome e o estado", () => {
    expect(legendaDaIndicacao({ nome: "x", status: "confirmado", quando: null })).toBe("já provou 💗");
    expect(legendaDaIndicacao({ nome: "x", status: "convidado", quando: null })).toBe("ainda não veio");
  });

  it("nenhuma legenda expõe telefone ou e-mail", () => {
    for (const s of ["confirmado", "convidado"] as const) {
      const t = legendaDaIndicacao({ nome: "x", status: s, quando: null });
      expect(t).not.toMatch(/\d{4}/);
      expect(t).not.toContain("@");
    }
  });
});
