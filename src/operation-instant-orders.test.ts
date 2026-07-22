import { describe, expect, it } from "vitest";
import { extractPaymentUrl } from "./OperationInstantOrders";

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
});
