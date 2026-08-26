import { describe, expect, it } from "vitest";
import { operationWhatsAppUrl } from "./operation-whatsapp";

describe("WhatsApp da operação", () => {
  it("direciona o Android para o pacote do WhatsApp Business", () => {
    const url = operationWhatsAppUrl("+55 85 99999-9999", "Olá, cliente!", "Mozilla/5.0 Android");
    expect(url).toContain("package=com.whatsapp.w4b");
    expect(url).toContain("phone=5585999999999");
    expect(url).toContain("text=Ol%C3%A1%2C%20cliente!");
    expect(decodeURIComponent(url)).toContain("play.google.com/store/apps/details?id=com.whatsapp.w4b");
  });

  it("mantém WhatsApp Web fora do Android", () => {
    expect(operationWhatsAppUrl("+55 85 99999-9999", "Olá", "Windows")).toBe(
      "https://wa.me/5585999999999?text=Ol%C3%A1",
    );
  });
});
