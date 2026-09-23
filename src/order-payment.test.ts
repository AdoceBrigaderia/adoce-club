import { describe, expect, it } from "vitest";
import { pixMessage } from "../netlify/functions/_shared/whatsapp-order-bot";
describe("Pix informado pela Adoce", () => {
  it("envia a chave correta e pede comprovante sem afirmar pagamento", () => {
    expect(pixMessage()).toContain("pagamentos@adocebrigaderia.com.br");
    expect(pixMessage()).toMatch(/comprovante/i);
    expect(pixMessage()).not.toContain("pagamento@adocebrigaderia.com.br");
  });
});
