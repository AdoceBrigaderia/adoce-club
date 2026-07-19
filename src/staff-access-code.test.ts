import { describe, expect, it } from "vitest";
import { staffAccessMessage, staffAccessWhatsAppUrl } from "./staff-access-code";

const access = {
  code: "123456",
  fullName: "Ana Paula Rocha",
  email: "ana@example.com",
  phone: "+55 85 99999-9999",
  loginUrl: "https://projeto.supabase.co/auth/v1/verify?token=seguro",
};

describe("código assistido pela operação", () => {
  it("monta uma mensagem com código, e-mail e instruções", () => {
    const message = staffAccessMessage(access);
    expect(message).toContain("Olá, Ana!");
    expect(message).toContain("123456");
    expect(message).toContain("ana@example.com");
    expect(message).toContain(access.loginUrl);
    expect(message).toContain("entrar diretamente");
  });

  it("abre o WhatsApp somente quando existe telefone válido", () => {
    expect(staffAccessWhatsAppUrl(access)).toContain("wa.me/5585999999999");
    expect(staffAccessWhatsAppUrl({ ...access, phone: null })).toBeNull();
  });
});
