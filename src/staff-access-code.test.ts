import { describe, expect, it } from "vitest";
import { staffAccessMessage, staffAccessWhatsAppUrl } from "./staff-access-code";

const access = {
  code: "123456",
  fullName: "Ana Paula Rocha",
  email: "ana@example.com",
  phone: "+55 85 99999-9999",
};

describe("código assistido pela operação", () => {
  it("monta uma mensagem com código, e-mail e instruções", () => {
    const message = staffAccessMessage(access);
    expect(message).toContain("Olá, Ana!");
    expect(message).toContain("123456");
    expect(message).toContain("ana@example.com");
    expect(message).toContain("/#entrar");
  });

  it("abre o WhatsApp somente quando existe telefone válido", () => {
    expect(staffAccessWhatsAppUrl(access)).toContain("wa.me/5585999999999");
    expect(staffAccessWhatsAppUrl({ ...access, phone: null })).toBeNull();
  });
});
