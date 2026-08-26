import { describe, expect, it } from "vitest";
import {
  horaAmigavel,
  horariosDisponiveis,
  mensagemDaReserva,
  paraEnvio,
  podeReservar,
  resumoCurto,
  validar,
  type Reserva,
} from "./finalizar-reserva";
import { SEM_CALDA, adicionar, escolherCalda, usarPresente, type Sabor } from "./escolha-de-fatias";

const chocolatudo: Sabor = { id: "c", nome: "Chocolatudo", preco: 16, disponiveis: 13, fotoUrl: null };
const pudim: Sabor = { id: "p", nome: "Torta de Pudim", preco: 25, disponiveis: 12, fotoUrl: null, premium: true };
const sabores = [chocolatudo, pudim];

const horarios = horariosDisponiveis("18:00", "22:00");

function reserva(o: Partial<Reserva> = {}): Reserva {
  return { nome: "Annaliza Damasceno", telefone: "(85) 99272-2285", horario: "18:30", observacao: "", ...o };
}

function pedido() {
  let itens = adicionar(adicionar([], chocolatudo), pudim);
  itens = escolherCalda(itens, "c", 0, "Chocolate");
  itens = escolherCalda(itens, "p", 0, SEM_CALDA);
  return itens;
}

describe("só o necessário é pedido", () => {
  // "não ser obrigado a compartilhar algum dado dele que a gente não tem
  //  necessidade de saber"
  it("nome e WhatsApp bastam para reservar", () => {
    expect(podeReservar(reserva(), horarios)).toBe(true);
  });

  it("observação é opcional", () => {
    expect(podeReservar(reserva({ observacao: "" }), horarios)).toBe(true);
  });

  it("a reserva não carrega e-mail, CPF nem endereço", () => {
    const enviado = paraEnvio(reserva(), pedido());
    expect(Object.keys(enviado).sort()).toEqual(
      ["horario", "itens", "nome", "observacao", "telefone"],
    );
  });
});

describe("o que impede de reservar", () => {
  it("falta sobrenome", () => {
    expect(validar(reserva({ nome: "Annaliza" }), horarios)[0].texto).toBe("Falta o sobrenome.");
  });

  it("falta WhatsApp", () => {
    expect(validar(reserva({ telefone: "" }), horarios)[0].campo).toBe("telefone");
  });

  it("falta escolher horário", () => {
    expect(validar(reserva({ horario: "" }), horarios)[0].texto).toContain("Escolha um horário");
  });

  it("horário fora da janela é recusado", () => {
    // A loja abre às 18h; 15h30 não existe.
    const p = validar(reserva({ horario: "15:30" }), horarios);
    expect(p[0].texto).toContain("loja está fechada");
  });

  it("observação muito longa é barrada", () => {
    expect(validar(reserva({ observacao: "a".repeat(300) }), horarios)[0].campo).toBe("observacao");
  });

  it("as mensagens são curtas — é para ler no celular, de pé", () => {
    for (const p of validar(reserva({ nome: "A", telefone: "8", horario: "" }), horarios)) {
      expect(p.texto.length).toBeLessThan(45);
    }
  });
});

describe("horários de retirada", () => {
  it("vão de meia em meia hora dentro da janela", () => {
    expect(horariosDisponiveis("18:00", "20:00")).toEqual(["18:00", "18:30", "19:00", "19:30", "20:00"]);
  });

  it("janela invertida não gera horário", () => {
    expect(horariosDisponiveis("22:00", "18:00")).toEqual([]);
  });

  it("mostra como a gente fala", () => {
    expect(horaAmigavel("18:00")).toBe("18h");
    expect(horaAmigavel("19:30")).toBe("19h30");
  });
});

describe("a mensagem da reserva", () => {
  const texto = mensagemDaReserva(reserva(), pedido(), sabores, "Cantinho da Adoce");

  it("usa o primeiro nome e fecha com coração", () => {
    expect(texto.startsWith("Annaliza,")).toBe(true);
    expect(texto).toContain("💗");
  });

  it("lista sabores e caldas", () => {
    expect(texto).toContain("1 fatia de Chocolatudo · chocolate");
    expect(texto).toContain("Torta de Pudim · sem calda");
  });

  it("diz o total, o horário e o local", () => {
    expect(texto).toContain("R$ 41,00");
    expect(texto).toContain("18h30");
    expect(texto).toContain("Cantinho da Adoce");
  });

  it("NÃO promete separação — reservado não é separado", () => {
    // O erro que eu cometi ao escrever a confirmação da Juliana em 08/08.
    expect(texto.toLowerCase()).not.toContain("já estão separadas");
    expect(texto).toContain("Assim que separarmos");
  });

  it("explica que o pagamento vem depois", () => {
    expect(texto).toContain("o pagamento é só depois disso");
  });

  it("a fatia-presente aparece como presente, nunca como desconto", () => {
    let itens = adicionar([], chocolatudo);
    itens = escolherCalda(itens, "c", 0, "Chocolate");
    itens = usarPresente(itens, "c", 1);
    const t = mensagemDaReserva(reserva(), itens, sabores, "Cantinho da Adoce");
    expect(t).toContain("🎁 uma é presente");
    expect(t).toContain("R$ 0,00");
    expect(t.toLowerCase()).not.toContain("desconto");
    expect(t).not.toMatch(/-\s*R\$/);
  });
});

describe("resumo antes de confirmar", () => {
  it("diz quantas fatias e quanto dá", () => {
    expect(resumoCurto(pedido(), sabores)).toBe("2 fatias · R$ 41,00");
  });

  it("fala no singular com uma fatia", () => {
    expect(resumoCurto(adicionar([], chocolatudo), sabores)).toBe("1 fatia · R$ 16,00");
  });
});

describe("envio", () => {
  it("arruma o nome e formata o telefone", () => {
    const e = paraEnvio(reserva({ nome: "  annaliza damasceno " }), pedido());
    expect(e.nome).toBe("Annaliza Damasceno");
    expect(e.telefone).toBe("+5585992722285");
  });
});
