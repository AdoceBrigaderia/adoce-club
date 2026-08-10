import { describe, expect, it } from "vitest";
import {
  decidirPorta,
  podeOferecerCadastro,
  rotaLimpaDepoisDoLogin,
  tokenDoCartaoNaRota,
  tokenDoMagicLink,
  type Reconhecimento,
} from "./identidade-do-clube";

function situacao(o: Partial<Reconhecimento> = {}): Reconhecimento {
  return { sessao: false, tokenDoCartao: null, membro: null, tokenNaUrl: null, ...o };
}

const membro = { primeiroNome: "Annaliza", carimbos: 6 };

describe("o loop que o Rubens encontrou em 10/08", () => {
  // A home mostra "6 de 14" e o perfil manda cadastrar de novo.
  it("quem o site reconhece NUNCA recebe convite para cadastrar", () => {
    const casos = [
      situacao({ sessao: true }),
      situacao({ tokenDoCartao: "abc12345" }),
      situacao({ membro }),
      situacao({ membro, tokenNaUrl: "eyJ" }),
    ];
    for (const caso of casos) {
      expect(podeOferecerCadastro(caso)).toBe(false);
      expect(decidirPorta(caso).porta).not.toBe("convite");
    }
  });

  it("reconhecido sem forma de abrir vira conflito, não cadastro", () => {
    const d = decidirPorta(situacao({ membro }));
    expect(d.porta).toBe("conflito");
    expect(d.titulo).toBe("Olá, Annaliza");
    expect(d.mensagem).toContain("6 carimbos");
  });

  it("a mensagem do conflito não manda cadastrar — isso perderia os carimbos", () => {
    const texto = decidirPorta(situacao({ membro })).mensagem.toLowerCase();
    expect(texto).not.toContain("cadastr");
    expect(texto).not.toContain("criar conta");
  });

  it("só quem é desconhecido recebe o convite", () => {
    expect(podeOferecerCadastro(situacao())).toBe(true);
    expect(decidirPorta(situacao()).porta).toBe("convite");
  });
});

describe("Magic Link", () => {
  it("o token na URL abre o cartão em vez de ser ignorado", () => {
    const d = decidirPorta(situacao({ tokenNaUrl: "eyJhbGciOi" }));
    expect(d.porta).toBe("abrindo");
  });

  it("com sessão já estabelecida, não fica preso em 'abrindo'", () => {
    expect(decidirPorta(situacao({ sessao: true, tokenNaUrl: "eyJ" })).porta).toBe("cartao");
  });

  it("lê o token do fragmento devolvido pelo Supabase", () => {
    expect(tokenDoMagicLink("#access_token=eyJabc&refresh_token=xyz&type=magiclink")).toBe("eyJabc");
  });

  it("não inventa token onde não há", () => {
    expect(tokenDoMagicLink("#clube")).toBeNull();
    expect(tokenDoMagicLink("")).toBeNull();
  });

  it("depois de usar, a rota volta limpa — o token não fica no histórico", () => {
    // Havia 7 registros com o token completo do cliente em site_analytics_events.
    expect(rotaLimpaDepoisDoLogin).toBe("#clube");
    expect(rotaLimpaDepoisDoLogin).not.toContain("access_token");
  });
});

describe("QR impresso na sacola", () => {
  it("abre o cartão sem senha, sem e-mail, sem nada", () => {
    // É o único caminho que serve para quem está sem dado móvel:
    // o papel já está na mão dele.
    const d = decidirPorta(situacao({ tokenDoCartao: "Zx9-abc_123" }));
    expect(d.porta).toBe("cartao");
  });

  it("lê o token da rota", () => {
    expect(tokenDoCartaoNaRota("#cartao/Zx9-abc_123")).toBe("Zx9-abc_123");
  });

  it("recusa rota que não é de cartão", () => {
    expect(tokenDoCartaoNaRota("#clube")).toBeNull();
    expect(tokenDoCartaoNaRota("#cartao/curto")).toBeNull();
  });
});

describe("saudação", () => {
  it("usa o primeiro nome quando conhece", () => {
    expect(decidirPorta(situacao({ sessao: true, membro })).titulo).toBe("Olá, Annaliza");
  });

  it("não inventa nome quando não tem", () => {
    expect(decidirPorta(situacao({ sessao: true })).titulo).toBe("Seu cartão");
  });

  it("o convite explica a regra certa: paga 14, a 15ª é presente", () => {
    const m = decidirPorta(situacao()).mensagem;
    expect(m).toContain("14");
    expect(m).toContain("15ª");
    expect(m).toContain("dez segundos");
  });
});
