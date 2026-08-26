import { describe, expect, it } from "vitest";
import {
  ESTEIRA,
  JORNADA,
  encerrado,
  linkDeWhatsApp,
  mensagemParaCliente,
  pendencia,
  podeCobrar,
  proximaEtapa,
  rotuloDoAvanco,
  type Etapa,
  type Pedido,
} from "./jornada-do-pedido";

function pedido(overrides: Partial<Pedido> = {}): Pedido {
  return {
    numero: "FAT-20260808-0026",
    cliente: "Juliana Vidal",
    telefone: "+5585997773599",
    etapa: "awaiting_confirmation",
    itens: [
      { sabor: "Chocolatudo", quantidade: 1, calda: "Calda de chocolate", presente: false },
      { sabor: "Torta de Pudim", quantidade: 1, calda: null, presente: false },
    ],
    total: 36,
    retirada: { local: "Cantinho da Adoce", aPartirDe: "18h" },
    pago: false,
    ...overrides,
  };
}

describe("a regra do pagamento", () => {
  // "o cliente so deve realizar o pagamento depois que a gente confirme
  //  que aquele produto foi reservado ou separado pra ele"
  it("não cobra antes de separar", () => {
    for (const etapa of ["awaiting_confirmation", "reserved", "preparing"] as Etapa[]) {
      expect(podeCobrar(pedido({ etapa }))).toBe(false);
    }
  });

  it("só libera a cobrança depois de separado", () => {
    expect(podeCobrar(pedido({ etapa: "awaiting_payment" }))).toBe(true);
    expect(podeCobrar(pedido({ etapa: "ready" }))).toBe(true);
  });

  it("não cobra duas vezes", () => {
    expect(podeCobrar(pedido({ etapa: "awaiting_payment", pago: true }))).toBe(false);
  });
});

describe("caminho do pedido", () => {
  it("segue a esteira na ordem", () => {
    const caminho: Etapa[] = [];
    let atual: Etapa = "awaiting_confirmation";
    for (let i = 0; i < 10; i += 1) {
      caminho.push(atual);
      const proxima = proximaEtapa(pedido({ etapa: atual }));
      if (!proxima) break;
      atual = proxima;
    }
    expect(caminho).toEqual(ESTEIRA);
  });

  it("quem já pagou pula a etapa de aguardar pagamento", () => {
    expect(proximaEtapa(pedido({ etapa: "preparing", pago: true }))).toBe("ready");
    expect(rotuloDoAvanco(pedido({ etapa: "preparing", pago: true }))).toBe("Marcar como separado");
  });

  it("etapas finais não avançam", () => {
    for (const etapa of ["completed", "cancelled", "expired"] as Etapa[]) {
      expect(proximaEtapa(pedido({ etapa }))).toBeNull();
      expect(encerrado(etapa)).toBe(true);
    }
  });

  it("cancelado e expirado ficam fora da linha do tempo", () => {
    expect(JORNADA.cancelled.passo).toBeNull();
    expect(JORNADA.expired.passo).toBeNull();
  });
});

describe("mensagens ao cliente", () => {
  it("nunca promete separação antes de separar", () => {
    // O erro que eu cometi ao escrever a confirmação da Juliana Vidal.
    for (const etapa of ["awaiting_confirmation", "reserved"] as Etapa[]) {
      const texto = mensagemParaCliente(pedido({ etapa })).toLowerCase();
      expect(texto).not.toContain("separada");
      expect(texto).not.toContain("separado");
    }
  });

  it("a reserva confirmada fala em guardado, não em separado", () => {
    const texto = mensagemParaCliente(pedido({ etapa: "reserved" }));
    expect(texto).toContain("guardado no seu nome");
    expect(texto).toContain("Cantinho da Adoce");
    expect(texto).toContain("18h");
  });

  it("a cobrança explica por que só agora", () => {
    const texto = mensagemParaCliente(pedido({ etapa: "awaiting_payment" }));
    expect(texto).toContain("depois de garantir que está tudo separado");
  });

  it("usa o primeiro nome e fecha com coração", () => {
    const texto = mensagemParaCliente(pedido());
    expect(texto.startsWith("Juliana,")).toBe(true);
    expect(texto).toContain("💗");
  });

  it("mostra a calda de cada fatia, e diz quando não tem", () => {
    const texto = mensagemParaCliente(pedido({ etapa: "reserved" }));
    expect(texto).toContain("Chocolatudo com calda de chocolate");
    expect(texto).toContain("Torta de Pudim, sem calda");
  });

  it("a fatia-presente aparece como presente, nunca como desconto", () => {
    const texto = mensagemParaCliente(
      pedido({
        etapa: "reserved",
        itens: [{ sabor: "Chocolatudo", quantidade: 1, calda: null, presente: true }],
      }),
    );
    expect(texto).toContain("🎁 sua fatia-presente");
    // Presente nunca vira cupom nem valor negativo.
    expect(texto).not.toMatch(/-\s*R\$|R\$\s*-/);
    expect(texto.toLowerCase()).not.toContain("desconto");
    expect(texto.toLowerCase()).not.toContain("cupom");
  });

  it("o cancelamento não culpa o cliente e oferece conserto", () => {
    const texto = mensagemParaCliente(pedido({ etapa: "cancelled" }));
    expect(texto).toContain("engano nosso");
  });

  it("toda etapa tem mensagem, nenhuma fica muda", () => {
    for (const etapa of Object.keys(JORNADA) as Etapa[]) {
      expect(mensagemParaCliente(pedido({ etapa })).length).toBeGreaterThan(20);
    }
  });
});

describe("link do WhatsApp", () => {
  it("limpa o telefone e leva a mensagem pronta", () => {
    const link = linkDeWhatsApp(pedido({ etapa: "reserved" }));
    expect(link.startsWith("https://wa.me/5585997773599?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("reserva está confirmada");
  });
});

describe("pedido parado", () => {
  const agora = Date.now();

  it("sem resposta por 15 minutos já é crítico", () => {
    const resultado = pendencia(pedido(), agora, agora - 20 * 60_000);
    expect(resultado?.gravidade).toBe("critico");
    expect(resultado?.texto).toContain("20 min");
  });

  it("conta em horas quando passa de uma hora — o caso da Juliana Sousa", () => {
    const resultado = pendencia(pedido(), agora, agora - 5 * 3_600_000);
    expect(resultado?.texto).toContain("5h");
  });

  it("recém-chegado não vira alarme", () => {
    expect(pendencia(pedido(), agora, agora - 2 * 60_000)).toBeNull();
  });

  it("pedido encerrado nunca fica pendente", () => {
    expect(pendencia(pedido({ etapa: "completed" }), agora, agora - 99 * 3_600_000)).toBeNull();
  });
});
