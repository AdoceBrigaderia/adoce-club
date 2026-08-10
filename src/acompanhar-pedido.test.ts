import { describe, expect, it } from "vitest";
import {
  encerramento,
  estadoDoPasso,
  etapasVisiveis,
  faltaParaRetirada,
  vistaDoCliente,
} from "./acompanhar-pedido";
import type { Etapa, Pedido } from "./jornada-do-pedido";

function pedido(etapa: Etapa, o: Partial<Pedido> = {}): Pedido {
  return {
    numero: "FAT-20260808-0026",
    cliente: "Juliana Vidal",
    telefone: "+5585997773599",
    etapa,
    itens: [{ sabor: "Chocolatudo", quantidade: 1, calda: "Calda de chocolate", presente: false }],
    total: 16,
    retirada: { local: "Cantinho da Adoce", aPartirDe: "18h" },
    pago: false,
    ...o,
  };
}

describe("o cliente vê onde está", () => {
  // Em 08/08 a Juliana reservou e ficou sem saber se valia.
  it("mostra a etapa atual com nome de gente", () => {
    expect(vistaDoCliente(pedido("awaiting_confirmation")).titulo).toBe("Reserva recebida");
    expect(vistaDoCliente(pedido("awaiting_payment")).titulo).toBe("Separado");
    expect(vistaDoCliente(pedido("ready")).titulo).toBe("Pronto para retirar");
  });

  it("diz o que vem depois, para ninguém ficar no escuro", () => {
    expect(vistaDoCliente(pedido("awaiting_confirmation")).aSeguir).toContain("confirmamos");
    expect(vistaDoCliente(pedido("reserved")).aSeguir).toContain("separar");
    expect(vistaDoCliente(pedido("ready")).aSeguir).toContain("esperando você");
  });

  it("etapa encerrada não promete próximo passo", () => {
    for (const e of ["completed", "cancelled", "expired"] as Etapa[]) {
      expect(vistaDoCliente(pedido(e)).aSeguir).toBe("");
    }
  });

  it("nenhuma etapa aberta fica sem explicação", () => {
    for (const e of ["awaiting_confirmation", "reserved", "preparing", "awaiting_payment", "paid", "ready"] as Etapa[]) {
      const v = vistaDoCliente(pedido(e));
      expect(v.agora.length).toBeGreaterThan(10);
      expect(v.aSeguir.length).toBeGreaterThan(10);
    }
  });
});

describe("pagamento só depois de separado", () => {
  it("não pede pagamento antes", () => {
    for (const e of ["awaiting_confirmation", "reserved", "preparing"] as Etapa[]) {
      expect(vistaDoCliente(pedido(e)).esperandoPagamento).toBe(false);
    }
  });

  it("pede quando está separado", () => {
    expect(vistaDoCliente(pedido("awaiting_payment")).esperandoPagamento).toBe(true);
  });

  it("quem já pagou não é cobrado de novo", () => {
    expect(vistaDoCliente(pedido("awaiting_payment", { pago: true })).esperandoPagamento).toBe(false);
  });
});

describe("linha do tempo", () => {
  it("tem cinco etapas visíveis — 'retirado' não entra", () => {
    const etapas = etapasVisiveis();
    expect(etapas).toHaveLength(5);
    expect(etapas.map((e) => e.etapa)).not.toContain("completed");
  });

  it("marca o que passou, o agora e o que falta", () => {
    expect(estadoDoPasso(1, 3)).toBe("feito");
    expect(estadoDoPasso(3, 3)).toBe("agora");
    expect(estadoDoPasso(5, 3)).toBe("futuro");
  });

  it("o passo atual bate com a etapa", () => {
    expect(vistaDoCliente(pedido("preparing")).passo).toBe(3);
    expect(vistaDoCliente(pedido("ready")).passo).toBe(5);
  });
});

describe("contagem para a retirada", () => {
  const agora = Date.now();

  it("mostra minutos quando falta pouco", () => {
    expect(faltaParaRetirada(new Date(agora + 25 * 60000).toISOString(), agora)).toBe("Falta cerca de 25 min.");
  });

  it("mostra horas quando falta mais", () => {
    expect(faltaParaRetirada(new Date(agora + 3 * 3600000).toISOString(), agora)).toBe("Faltam cerca de 3 horas.");
    expect(faltaParaRetirada(new Date(agora + 3600000).toISOString(), agora)).toBe("Falta cerca de 1 hora.");
  });

  it("passou da hora, convida em vez de cobrar", () => {
    const texto = faltaParaRetirada(new Date(agora - 3600000).toISOString(), agora);
    expect(texto).toBe("Já pode vir buscar.");
    expect(texto.toLowerCase()).not.toContain("atras");
  });

  it("sem horário combinado, não inventa", () => {
    expect(faltaParaRetirada(null)).toBe("");
    expect(faltaParaRetirada("nao é data")).toBe("");
  });
});

describe("encerramento", () => {
  it("distingue retirado, cancelado e expirado", () => {
    expect(encerramento("completed")).toContain("Obrigado");
    expect(encerramento("cancelled")).toContain("cancelado");
    expect(encerramento("expired")).toContain("prazo");
  });

  it("pedido em andamento não recebe mensagem de fim", () => {
    expect(encerramento("reserved")).toBe("");
  });
});
