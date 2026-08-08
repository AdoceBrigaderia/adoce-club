import { describe, expect, it } from "vitest";
import type { PedeJuntoParticipant, PedeJuntoRoom } from "./pede-junto";
import {
  lembreteDeQuemFalta,
  prazoDoGrupo,
  proximaAtualizacaoMs,
  quemAindaNaoEscolheu,
  relogioDe,
  tempoRestante,
  urgenciaDe,
} from "./pede-junto-prazo";

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

function participante(
  nome: string,
  overrides: Partial<PedeJuntoParticipant> = {},
): PedeJuntoParticipant {
  return {
    id: nome,
    name: nome,
    status: "active",
    is_viewer: false,
    payment_url: null,
    payment_expires_at: null,
    items: [],
    ...overrides,
  };
}

function comFatia(nome: string, quantidade = 1) {
  return participante(nome, {
    items: [
      {
        id: `${nome}-1`,
        flavor_id: "f1",
        flavor_name: "Chocolatudo",
        unit_price: 16,
        quantity: quantidade,
        status: "selected",
      },
    ],
  });
}

function sala(overrides: Partial<PedeJuntoRoom> = {}): PedeJuntoRoom {
  return {
    id: "g1",
    public_code: "ABC123",
    name: "Intervalo da firma",
    organizer_name: "Rubens",
    delivery_address: "Rua tal, 100",
    delivery_reference: null,
    minimum_slices: 5,
    total_slices: 3,
    total_value: 48,
    status: "open",
    closes_at: new Date(Date.now() + 3 * HORA).toISOString(),
    free_delivery: false,
    participants: [],
    ...overrides,
  };
}

describe("relÃ³gio", () => {
  it("mostra dias quando falta muito", () => {
    expect(relogioDe(2 * 24 * HORA)).toBe("2 dias");
    expect(relogioDe(25 * HORA)).toBe("1 dia");
  });

  it("mostra horas e minutos juntos", () => {
    expect(relogioDe(2 * HORA + 14 * MINUTO)).toBe("2h14");
  });

  it("omite os minutos quando Ã© hora cheia", () => {
    expect(relogioDe(3 * HORA)).toBe("3h");
  });

  it("nunca mostra zero minuto enquanto ainda hÃ¡ tempo", () => {
    expect(relogioDe(30_000)).toBe("1 min");
  });

  it("diz encerrado quando o tempo acabou", () => {
    expect(relogioDe(0)).toBe("encerrado");
    expect(relogioDe(-5000)).toBe("encerrado");
  });
});

describe("tempo restante", () => {
  it("nunca fica negativo", () => {
    const passado = new Date(Date.now() - HORA).toISOString();
    expect(tempoRestante(passado)).toBe(0);
  });

  it("nÃ£o quebra com data invÃ¡lida", () => {
    expect(tempoRestante("nao Ã© data")).toBe(0);
  });
});

describe("urgÃªncia", () => {
  it("Ã© tranquilo com folga", () => {
    expect(urgenciaDe(5 * HORA)).toBe("tranquilo");
  });

  it("vira atenÃ§Ã£o nas Ãºltimas duas horas", () => {
    expect(urgenciaDe(90 * MINUTO)).toBe("atencao");
  });

  it("vira Ãºltima chamada na Ãºltima meia hora", () => {
    expect(urgenciaDe(20 * MINUTO)).toBe("ultima_chamada");
  });
});

describe("quem ainda nÃ£o escolheu", () => {
  it("aponta sÃ³ quem entrou e nÃ£o pediu nada", () => {
    const participantes = [comFatia("Ana"), participante("Bruno")];
    expect(quemAindaNaoEscolheu(participantes).map((p) => p.name)).toEqual(["Bruno"]);
  });

  it("ignora quem foi removido ou cancelou", () => {
    const participantes = [
      participante("Carla", { status: "removed" }),
      participante("Diego", { status: "cancelled" }),
    ];
    expect(quemAindaNaoEscolheu(participantes)).toHaveLength(0);
  });

  it("nÃ£o conta item cancelado como escolha", () => {
    const participantes = [
      participante("Elis", {
        items: [
          {
            id: "i1",
            flavor_id: "f1",
            flavor_name: "Chocolatudo",
            unit_price: 16,
            quantity: 1,
            status: "cancelled",
          },
        ],
      }),
    ];
    expect(quemAindaNaoEscolheu(participantes).map((p) => p.name)).toEqual(["Elis"]);
  });
});

describe("frase do grupo", () => {
  it("nomeia quem falta, para o organizador nÃ£o cobrar todo mundo", () => {
    const room = sala({ participants: [comFatia("Ana"), participante("Bruno Silva")] });
    expect(prazoDoGrupo(room).frase).toContain("Bruno");
    expect(prazoDoGrupo(room).frase).not.toContain("Ana");
  });

  it("junta os nomes com e, sem vÃ­rgula sobrando", () => {
    const room = sala({
      participants: [participante("Ana"), participante("Bruno"), participante("Carla")],
    });
    expect(prazoDoGrupo(room).frase).toContain("Ana, Bruno e Carla");
  });

  it("com folga e todo mundo servido, convida mais gente em vez de cobrar", () => {
    // O Rubens foi explÃ­cito: cinco Ã© o mÃ­nimo, nÃ£o o teto. JÃ¡ houve grupo
    // com onze moradores.
    const room = sala({ participants: [comFatia("Ana"), comFatia("Bruno")] });
    expect(prazoDoGrupo(room).frase).toContain("Ainda cabe mais gente");
  });

  it("perto do fim e todo mundo servido, libera o organizador para fechar", () => {
    const room = sala({
      closes_at: new Date(Date.now() + 90 * MINUTO).toISOString(),
      participants: [comFatia("Ana"), comFatia("Bruno")],
    });
    expect(prazoDoGrupo(room).frase).toContain("todo mundo já escolheu");
  });

  it("nÃ£o apressa com medo â€” nunca diz que vai acabar", () => {
    const room = sala({
      closes_at: new Date(Date.now() + 10 * MINUTO).toISOString(),
      participants: [participante("Ana")],
    });
    const frase = prazoDoGrupo(room).frase;
    expect(frase).toContain("Últimos");
    expect(frase.toLowerCase()).not.toContain("corre");
    expect(frase.toLowerCase()).not.toContain("acabar");
  });

  it("grupo fechado nÃ£o mostra contagem", () => {
    const room = sala({ status: "submitted" });
    const prazo = prazoDoGrupo(room);
    expect(prazo.urgencia).toBe("encerrado");
    expect(prazo.relogio).toBe("encerrado");
  });

  it("prazo vencido encerra mesmo com status aberto", () => {
    const room = sala({ closes_at: new Date(Date.now() - MINUTO).toISOString() });
    expect(prazoDoGrupo(room).urgencia).toBe("encerrado");
  });
});

describe("lembrete para o WhatsApp", () => {
  it("nÃ£o gera lembrete quando ninguÃ©m falta", () => {
    const room = sala({ participants: [comFatia("Ana")] });
    expect(lembreteDeQuemFalta(room)).toBe("");
  });

  it("cita o grupo, o prazo e sÃ³ quem falta", () => {
    const room = sala({ participants: [comFatia("Ana"), participante("Bruno")] });
    const texto = lembreteDeQuemFalta(room);
    expect(texto).toContain("Intervalo da firma");
    expect(texto).toContain("Bruno");
    expect(texto).not.toContain("Ana");
    expect(texto).toContain("💗");
  });

  it("nÃ£o manda link â€” cliente sem internet nÃ£o abre e se constrange", () => {
    const room = sala({ participants: [participante("Bruno")] });
    expect(lembreteDeQuemFalta(room)).not.toContain("http");
  });
});

describe("ritmo de atualizaÃ§Ã£o", () => {
  it("Ã© lento quando falta muito tempo", () => {
    expect(proximaAtualizacaoMs(5 * HORA)).toBe(MINUTO);
  });

  it("acelera na reta final", () => {
    expect(proximaAtualizacaoMs(10 * MINUTO)).toBe(15_000);
  });

  it("para quando encerrou", () => {
    expect(proximaAtualizacaoMs(0)).toBe(0);
  });
});
