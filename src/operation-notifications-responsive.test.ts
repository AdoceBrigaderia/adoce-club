import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const accessStyles = readFileSync(new URL("./access-app.css", import.meta.url), "utf8");
const notificationStyles = readFileSync(new URL("./operation-notifications.css", import.meta.url), "utf8");
const notificationSource = readFileSync(new URL("./OperationNotificationCenter.tsx", import.meta.url), "utf8");

describe("alertas da operação em telas móveis", () => {
  it("limita a regra compacta aos botões diretos do cabeçalho", () => {
    expect(accessStyles).toContain(".operation-home > header > div > button");
    expect(accessStyles).not.toContain(".operation-home > header > div button {");
  });

  it("mantém o painel dentro da largura e altura do celular", () => {
    expect(notificationStyles).toContain("position: fixed");
    expect(notificationStyles).toContain("left: 10px");
    expect(notificationStyles).toContain("right: 10px");
    expect(notificationStyles).toContain("bottom: 84px");
  });

  it("oferece uma prévia fiel para validação visual antes da publicação", () => {
    expect(notificationSource).toContain("OperationNotificationPreview");
    expect(notificationSource).toContain("Novo cadastro no Clube Adoce");
    expect(notificationSource).toContain("Novo pedido para retirada");
  });
});
