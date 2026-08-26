import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { extractPaymentUrl } from "./OperationInstantOrders";

const operationSource = readFileSync(new URL("./OperationInstantOrders.tsx", import.meta.url), "utf8");
const operationStyles = readFileSync(new URL("./operation-instant-orders-enhancements.css", import.meta.url), "utf8");

describe("instant order payment links", () => {
  it("extracts a Mercado Pago link from the complete copied message", () => {
    expect(extractPaymentUrl("Acesse o link para pagar https://mpago.la/2vbkbGX")).toBe(
      "https://mpago.la/2vbkbGX",
    );
  });

  it("removes punctuation pasted after the link", () => {
    expect(extractPaymentUrl("Pague em https://mpago.la/abc123.")).toBe(
      "https://mpago.la/abc123",
    );
  });

  it("mantém a confirmação direta visível e mostra falhas dentro do painel", () => {
    expect(operationSource).toContain('ref={directFinishRef}');
    expect(operationSource).toContain('Finalizando...');
    expect(operationSource).toContain('className="instant-order-direct-error"');
    expect(operationSource).toContain('Não foi possível finalizar:');
    expect(operationStyles).toContain('.operation-home:has(.instant-order-operation-layer) > .operation-mobile-tabbar');
  });
});
