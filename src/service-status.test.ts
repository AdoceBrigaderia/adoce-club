import { describe, expect, it } from "vitest";
import { serviceStatusMessage } from "./service-status";

describe("serviceStatusMessage", () => {
  it("não mostra mensagem positiva de canal quando o horário está fechado", () => {
    expect(serviceStatusMessage({
      open: false,
      paused: false,
      channelMessage: "Estamos abertos!",
      scheduleMessage: "Atendimento das 12h às 18h.",
      pausedMessage: "Atendimento pausado.",
    })).toBe("Atendimento das 12h às 18h.");
  });

  it("prioriza o aviso de pausa sobre mensagens antigas", () => {
    expect(serviceStatusMessage({
      open: false,
      paused: true,
      channelMessage: "Estamos abertos!",
      scheduleMessage: "Atendimento das 12h às 18h.",
      pausedMessage: "Atendimento presencial pausado no momento.",
    })).toBe("Atendimento presencial pausado no momento.");
  });

  it("usa a mensagem do canal quando o serviço realmente está aberto", () => {
    expect(serviceStatusMessage({
      open: true,
      paused: false,
      channelMessage: "Estamos abertos!",
      scheduleMessage: "Atendimento até as 18h.",
      pausedMessage: "Atendimento pausado.",
    })).toBe("Estamos abertos!");
  });
});
