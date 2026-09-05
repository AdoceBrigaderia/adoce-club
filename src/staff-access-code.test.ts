import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { staffAccessMessage } from "./staff-access-code";

const access = {
  code: "123456",
  fullName: "Ana Paula Rocha",
  email: "ana@example.com",
  phone: "+55 85 99999-9999",
  loginUrl: "https://www.adocebrigaderia.com.br/clube/acesso-direto?email=ana%40example.com&code=123456",
};

describe("código assistido pela operação", () => {
  it("monta uma mensagem com código, e-mail e instruções", () => {
    const message = staffAccessMessage(access);
    expect(message).toContain("Olá, Ana!");
    expect(message).toContain("123456");
    expect(message).toContain("ana@example.com");
    expect(message).toContain(access.loginUrl);
    expect(message).toContain("entrar diretamente");
    expect(access.loginUrl).toContain("/clube/acesso-direto?");
  });

  it("não oferece envio pelo wa.me do próprio atendente", () => {
    // Abrir wa.me/<cliente> usa o WhatsApp pessoal de quem está no balcão,
    // não o número oficial. O helper foi removido e a tela do código gerado
    // não pode reintroduzir um link wa.me.
    const module = readFileSync(new URL("./staff-access-code.ts", import.meta.url), "utf8");
    // Nenhum código que monte um link wa.me/<número> (com interpolação),
    // independente do nome da variável ou dos espaços.
    expect(module).not.toMatch(/wa\.me\/\$\{/);
    expect(module).not.toMatch(/staffAccessWhatsAppUrl/);
    const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
    expect(access).not.toMatch(/staffAccessWhatsAppUrl/);
  });
});
