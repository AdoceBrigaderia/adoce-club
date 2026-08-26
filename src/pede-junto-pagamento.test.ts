import { describe, expect, it } from "vitest";
import {
  dinheiro,
  faltamPagar,
  jaPagaram,
  lembreteDePagamento,
  listaParaOrganizador,
  montarGrupo,
  podeCobrar,
  resumoParaOrganizador,
  situacaoDoParticipante,
  todosPagaram,
  totalDoGrupo,
  totalRecebido,
  type EstadoDoPagamento,
  type GrupoDePagamento,
  type LinhaDoGrupo,
  type LinhaDoParticipante,
  type ParticipanteDoPagamento,
  type StatusDoGrupo,
} from "./pede-junto-pagamento";

function pessoa(
  nome: string,
  estado: EstadoDoPagamento = "a_pagar",
  fatias = 1,
): ParticipanteDoPagamento {
  return {
    id: nome, nome, fatias, valor: fatias * 16, estado,
    linkDePagamento: estado === "aguardando_fechamento" ? null : "https://mp.test/x",
    expiraEm: null,
  };
}

function grupo(o: Partial<GrupoDePagamento> = {}): GrupoDePagamento {
  return {
    nome: "Sala 302", totalDeFatias: 6, entregaGratis: true,
    fechado: true, separado: true,
    participantes: [pessoa("Juliana Sousa"), pessoa("Marcos Lima", "pago")],
    ...o,
  };
}

describe("ninguém paga antes de a Adoce separar", () => {
  it("grupo aberto não cobra", () => {
    expect(podeCobrar(grupo({ fechado: false, separado: false }))).toBe(false);
  });

  it("fechado mas ainda não separado também não cobra", () => {
    expect(podeCobrar(grupo({ separado: false }))).toBe(false);
  });

  it("separado libera a cobrança", () => {
    expect(podeCobrar(grupo())).toBe(true);
  });

  it("enquanto o grupo está aberto o participante sabe que não paga nada", () => {
    const g = grupo({ fechado: false });
    expect(situacaoDoParticipante(pessoa("x", "aguardando_fechamento"), g))
      .toContain("paga depois");
  });
});

describe("o organizador acompanha, não cobra", () => {
  // "o organizador fica com toda a responsabilidade dos pagamentos e isso
  //  faz com que eles desistam"
  it("o resumo diz em voz alta que ele não precisa cobrar ninguém", () => {
    expect(resumoParaOrganizador(grupo())).toContain("não precisa cobrar ninguém");
  });

  it("com o grupo aberto, mostra quanto falta para a entrega grátis", () => {
    const texto = resumoParaOrganizador(grupo({ fechado: false, totalDeFatias: 3 }));
    expect(texto).toContain("faltam 2");
  });

  it("cinco fatias é o mínimo, não o teto — ainda cabe mais gente", () => {
    const texto = resumoParaOrganizador(grupo({ fechado: false, totalDeFatias: 11 }));
    expect(texto).toContain("Ainda cabe mais gente");
  });

  it("quando todos acertaram, a mensagem fecha o assunto", () => {
    const g = grupo({ participantes: [pessoa("A", "pago"), pessoa("B", "pago")] });
    expect(todosPagaram(g)).toBe(true);
    expect(resumoParaOrganizador(g)).toContain("É só buscar");
  });

  it("ele vê quem pagou, nunca como pagou", () => {
    const lista = listaParaOrganizador(grupo());
    expect(lista).toEqual([
      { nome: "Juliana Sousa", fatias: 1, pagou: false },
      { nome: "Marcos Lima", fatias: 1, pagou: true },
    ]);
    for (const linha of lista) {
      expect(Object.keys(linha)).toEqual(["nome", "fatias", "pagou"]);
    }
  });
});

describe("o lembrete", () => {
  it("cita só quem falta, pelo primeiro nome", () => {
    const texto = lembreteDePagamento(grupo());
    expect(texto).toContain("Juliana");
    expect(texto).not.toContain("Marcos");
  });

  it("não existe antes de a Adoce separar", () => {
    expect(lembreteDePagamento(grupo({ separado: false }))).toBe("");
  });

  it("não existe quando ninguém deve", () => {
    const g = grupo({ participantes: [pessoa("A", "pago")] });
    expect(lembreteDePagamento(g)).toBe("");
  });

  it("fecha com o coração, como toda mensagem da Adoce", () => {
    expect(lembreteDePagamento(grupo()).trim().endsWith("💗")).toBe(true);
  });
});

describe("as contas do grupo", () => {
  it("soma o total e o que já entrou", () => {
    const g = grupo({
      participantes: [pessoa("A", "pago", 2), pessoa("B", "a_pagar", 1)],
    });
    expect(totalDoGrupo(g)).toBe(48);
    expect(totalRecebido(g)).toBe(32);
    expect(jaPagaram(g)).toHaveLength(1);
    expect(faltamPagar(g)).toHaveLength(1);
  });

  it("link expirado ainda conta como quem falta pagar", () => {
    const g = grupo({ participantes: [pessoa("A", "expirado")] });
    expect(faltamPagar(g)).toHaveLength(1);
    expect(todosPagaram(g)).toBe(false);
  });

  it("expirado não vira beco sem saída — o site já promete outro link", () => {
    expect(situacaoDoParticipante(pessoa("A", "expirado"), grupo()))
      .toContain("geramos outro");
  });

  it("preço sai sem o espaço invisível do formatador", () => {
    expect(dinheiro(32)).toBe("R$ 32,00");
  });
});

describe("a ponte com o banco que já existe", () => {
  // Nada de tabela nova: `pede_junto_groups` e `pede_junto_participants` estão
  // no ar desde 21/07, e o participante já tinha payment_url e paid_at.
  const linha = (o: Partial<LinhaDoParticipante> = {}): LinhaDoParticipante => ({
    id: "p1", name: "Juliana Sousa", status: "active",
    payment_url: null, payment_expires_at: null,
    fatias: 2, valor_centavos: 3200, ...o,
  });

  const cabeca = (status: StatusDoGrupo = "open"): LinhaDoGrupo => ({
    name: "Sala 302", status, minimum_slices: 5, free_delivery_unlocked_at: null,
  });

  it("grupo aberto ainda não cobra", () => {
    const g = montarGrupo(cabeca("open"), [linha()]);
    expect(g.fechado).toBe(false);
    expect(podeCobrar(g)).toBe(false);
  });

  it("enviado e confirmado ainda não é separado — ninguém paga", () => {
    for (const status of ["submitted", "confirmed"] as StatusDoGrupo[]) {
      expect(podeCobrar(montarGrupo(cabeca(status), [linha()]))).toBe(false);
    }
  });

  it("awaiting_payment é o momento em que a cobrança nasce", () => {
    expect(podeCobrar(montarGrupo(cabeca("awaiting_payment"), [linha()]))).toBe(true);
  });

  it("centavos viram reais", () => {
    const g = montarGrupo(cabeca(), [linha({ valor_centavos: 3200 })]);
    expect(g.participantes[0].valor).toBe(32);
  });

  it("quem saiu do grupo não aparece nem conta fatia", () => {
    const g = montarGrupo(cabeca(), [
      linha({ id: "a", fatias: 2 }),
      linha({ id: "b", status: "removed", fatias: 5 }),
      linha({ id: "c", status: "cancelled", fatias: 9 }),
    ]);
    expect(g.participantes).toHaveLength(1);
    expect(g.totalDeFatias).toBe(2);
  });

  it("link vencido vira expirado, não some", () => {
    const g = montarGrupo(
      cabeca("awaiting_payment"),
      [linha({ status: "payment_pending", payment_expires_at: "2026-08-10T00:00:00Z" })],
      new Date("2026-08-11T12:00:00Z"),
    );
    expect(g.participantes[0].estado).toBe("expirado");
  });

  it("link no prazo é a pagar", () => {
    const g = montarGrupo(
      cabeca("awaiting_payment"),
      [linha({ status: "payment_pending", payment_expires_at: "2026-08-12T00:00:00Z" })],
      new Date("2026-08-11T12:00:00Z"),
    );
    expect(g.participantes[0].estado).toBe("a_pagar");
  });

  it("entrega grátis destrava pelas cinco fatias, mesmo sem o carimbo do banco", () => {
    const g = montarGrupo(cabeca(), [linha({ fatias: 6 })]);
    expect(g.entregaGratis).toBe(true);
  });
});
