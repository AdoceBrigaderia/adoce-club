import { describe, expect, it } from "vitest";
import {
  ANTECEDENCIA_DIAS_UTEIS,
  FESTIVAL_POR_DIA,
  TETO_DOCINHOS_DIA,
  TETO_TORTAS_DIA,
  avaliarEncomenda,
  diasUteisAte,
  docinhosDisponiveis,
  ehDiaUtil,
  proximaDataPossivel,
  respostaAoCliente,
  tortasDisponiveis,
  tortasDoFestival,
  type Agenda,
} from "./capacidade-de-encomenda";

const dia = (iso: string) => new Date(`${iso}T12:00:00Z`);

// Referencias reais de agosto de 2026.
const SEGUNDA = dia("2026-08-10");
const TERCA = dia("2026-08-11");
const QUARTA = dia("2026-08-12");
const QUINTA = dia("2026-08-13");
const SEXTA = dia("2026-08-14");
const SABADO = dia("2026-08-15");
const DOMINGO = dia("2026-08-16");
const HOJE = dia("2026-08-08"); // sábado

function agenda(overrides: Partial<Agenda> = {}): Agenda {
  return {
    tortasAgendadas: 0,
    docinhosAgendados: 0,
    escolaReservada: false,
    ...overrides,
  };
}

describe("dias úteis", () => {
  it("sábado e domingo não são úteis", () => {
    expect(ehDiaUtil(SABADO)).toBe(false);
    expect(ehDiaUtil(DOMINGO)).toBe(false);
    expect(ehDiaUtil(SEGUNDA)).toBe(true);
  });

  it("não conta o dia de hoje", () => {
    expect(diasUteisAte(HOJE, HOJE)).toBe(0);
  });

  it("de sábado até quarta são três dias úteis", () => {
    // seg, ter, qua
    expect(diasUteisAte(QUARTA, HOJE)).toBe(3);
  });

  it("data no passado não gera dias úteis", () => {
    expect(diasUteisAte(dia("2026-08-01"), HOJE)).toBe(0);
  });
});

describe("o festival ocupa o teto", () => {
  // "as 5 que eu falei que pode entrar, já está contando com as que nós
  //  produzimos pro festival"
  it("conhece a produção fixa de cada dia", () => {
    expect(tortasDoFestival(TERCA)).toBe(3);
    expect(tortasDoFestival(QUINTA)).toBe(6);
    expect(tortasDoFestival(SABADO)).toBe(8);
    expect(FESTIVAL_POR_DIA.reduce((a, b) => a + b, 0)).toBe(28);
  });

  it("terça sobra 2 para encomenda, porque o festival já usa 3", () => {
    expect(tortasDisponiveis(TERCA, agenda())).toBe(2);
  });

  it("quinta, sexta e sábado não sobra nada: o festival já estoura o teto", () => {
    expect(tortasDisponiveis(QUINTA, agenda())).toBe(0);
    expect(tortasDisponiveis(SEXTA, agenda())).toBe(0);
    expect(tortasDisponiveis(SABADO, agenda())).toBe(0);
  });

  it("segunda não tem festival, então cabem as 5", () => {
    expect(tortasDisponiveis(SEGUNDA, agenda())).toBe(TETO_TORTAS_DIA);
  });

  it("o que já foi agendado também ocupa", () => {
    expect(tortasDisponiveis(SEGUNDA, agenda({ tortasAgendadas: 2 }))).toBe(3);
  });
});

describe("docinhos", () => {
  it("o teto é 300 por dia", () => {
    expect(docinhosDisponiveis(agenda())).toBe(TETO_DOCINHOS_DIA);
    expect(docinhosDisponiveis(agenda({ docinhosAgendados: 100 }))).toBe(200);
  });

  it("recusa o que passa do teto e diz quanto ainda cabe", () => {
    const veredito = avaliarEncomenda(
      { tortas: 0, docinhos: 250 },
      QUARTA,
      agenda({ docinhosAgendados: 100 }),
      HOJE,
    );
    expect(veredito.cabe).toBe(false);
    expect(veredito.motivos.join(" ")).toContain("200 docinhos");
  });

  it("os 100 docinhos da Gabriela cabem numa quarta tranquila", () => {
    const veredito = avaliarEncomenda({ tortas: 0, docinhos: 100 }, QUARTA, agenda(), HOJE);
    expect(veredito.cabe).toBe(true);
    expect(veredito.exigeAvaliacao).toBe(false);
    expect(veredito.restam.docinhos).toBe(200);
  });
});

describe("Adoce na Escola toma o dia inteiro", () => {
  // "o dia que tiver reserva de Adoce na escola, não pode ter mais nenhuma
  //  outra coisa agendado"
  it("bloqueia até um pedido pequeno", () => {
    const veredito = avaliarEncomenda(
      { tortas: 1, docinhos: 0 },
      QUARTA,
      agenda({ escolaReservada: true }),
      HOJE,
    );
    expect(veredito.cabe).toBe(false);
    expect(veredito.motivos.join(" ")).toContain("Adoce na Escola");
  });
});

describe("antecedência de 3 dias úteis", () => {
  it("com 3 dias úteis, confirma direto", () => {
    const veredito = avaliarEncomenda({ tortas: 1, docinhos: 0 }, QUARTA, agenda(), HOJE);
    expect(veredito.cabe).toBe(true);
    expect(veredito.exigeAvaliacao).toBe(false);
  });

  it("com menos, cabe mas pede avaliação humana — não recusa", () => {
    const veredito = avaliarEncomenda({ tortas: 1, docinhos: 0 }, SEGUNDA, agenda(), HOJE);
    expect(veredito.cabe).toBe(true);
    expect(veredito.exigeAvaliacao).toBe(true);
    expect(veredito.motivos.join(" ")).toContain(`${ANTECEDENCIA_DIAS_UTEIS}`);
  });
});

describe("sexta e sábado", () => {
  it("são dias cheios do Cantinho e pedem conferência", () => {
    const veredito = avaliarEncomenda(
      { tortas: 0, docinhos: 50 },
      dia("2026-08-21"), // sexta, com folga de antecedência
      agenda(),
      HOJE,
    );
    expect(veredito.cabe).toBe(true);
    expect(veredito.exigeAvaliacao).toBe(true);
    expect(veredito.motivos.join(" ")).toContain("Cantinho");
  });
});

describe("resposta ao cliente", () => {
  it("confirma sem rodeio quando cabe", () => {
    const veredito = avaliarEncomenda({ tortas: 1, docinhos: 0 }, QUARTA, agenda(), HOJE);
    expect(respostaAoCliente(veredito)).toContain("Conseguimos sim");
  });

  it("quando precisa avaliar, promete retorno no mesmo dia", () => {
    const veredito = avaliarEncomenda({ tortas: 1, docinhos: 0 }, SEGUNDA, agenda(), HOJE);
    expect(respostaAoCliente(veredito)).toContain("ainda hoje");
  });

  it("nunca dá um não seco — sempre oferece caminho", () => {
    const veredito = avaliarEncomenda(
      { tortas: 3, docinhos: 0 },
      QUINTA,
      agenda(),
      HOJE,
    );
    expect(veredito.cabe).toBe(false);
    const semData = respostaAoCliente(veredito);
    expect(semData).toContain("Podemos ver juntos");
    expect(respostaAoCliente(veredito, "17 de agosto")).toContain("17 de agosto");
  });

  it("toda resposta fecha com coração", () => {
    const cabe = avaliarEncomenda({ tortas: 1, docinhos: 0 }, QUARTA, agenda(), HOJE);
    const naoCabe = avaliarEncomenda({ tortas: 3, docinhos: 0 }, QUINTA, agenda(), HOJE);
    expect(respostaAoCliente(cabe)).toContain("💗");
    expect(respostaAoCliente(naoCabe)).toContain("💗");
  });
});

describe("próxima data possível", () => {
  it("pula os dias em que o festival já ocupa tudo", () => {
    const data = proximaDataPossivel({ tortas: 3, docinhos: 0 }, QUINTA, () => agenda(), HOJE);
    // Quinta, sexta e sábado estão tomados; domingo e segunda não têm festival.
    expect(data && data.getUTCDay()).not.toBe(4);
    expect(data && data.getUTCDay()).not.toBe(5);
    expect(data && data.getUTCDay()).not.toBe(6);
  });

  it("pula dia com Adoce na Escola", () => {
    const escola = dia("2026-08-19");
    const data = proximaDataPossivel(
      { tortas: 1, docinhos: 0 },
      escola,
      (d) => agenda({ escolaReservada: d.getUTCDate() === 19 }),
      HOJE,
    );
    expect(data?.getUTCDate()).not.toBe(19);
  });

  it("devolve nulo quando nada cabe no horizonte", () => {
    const data = proximaDataPossivel(
      { tortas: 1, docinhos: 0 },
      SEGUNDA,
      () => agenda({ bloqueado: true }),
      HOJE,
    );
    expect(data).toBeNull();
  });
});
