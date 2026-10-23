import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const alerts = readFileSync(new URL("./OperationSliceAlerts.tsx", import.meta.url), "utf8");
const operationProducts = readFileSync(new URL("./OperationContentAdmin.tsx", import.meta.url), "utf8");

describe("religamento do painel de avisos de fatia (auditoria funcional)", () => {
  it("monta o painel na aba Clientes, não dentro de Produção de hoje", () => {
    expect(access).toContain("<OperationSliceAlerts />");
    expect(operationProducts).not.toContain("<OperationSliceAlerts />");
  });

  it("leva para o carrinho de verdade, não para uma rota inexistente", () => {
    expect(alerts).toContain("/carrinho?flavor=");
    expect(alerts).not.toContain("/pedido?flavor=");
  });
});
