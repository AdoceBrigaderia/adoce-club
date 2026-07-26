import { describe, expect, it } from "vitest";
import {
  generateWhatsAppOtp,
  hashRequestOrigin,
  hashWhatsAppOtp,
  readMetaWhatsAppConfig,
} from "./whatsapp-otp-security";

const pepper = "a".repeat(64);

describe("segurança do OTP WhatsApp", () => {
  it("gera códigos numéricos de seis posições", () => {
    const codes = Array.from({ length: 100 }, () => generateWhatsAppOtp());
    expect(codes.every((code) => /^\d{6}$/.test(code))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(90);
  });

  it("vincula o hash ao desafio e ao segredo do servidor", () => {
    const first = hashWhatsAppOtp(
      "11111111-1111-4111-8111-111111111111",
      "428731",
      pepper,
    );
    const second = hashWhatsAppOtp(
      "22222222-2222-4222-8222-222222222222",
      "428731",
      pepper,
    );
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain("428731");
  });

  it("anonimiza a origem para rate limit", () => {
    const hash = hashRequestOrigin("200.10.20.30", pepper);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("200.10.20.30");
  });

  it("recusa configuração incompleta e aceita segredos externos", () => {
    expect(() => readMetaWhatsAppConfig(() => undefined)).toThrow(/incompleta/);
    const values: Record<string, string> = {
      META_WA_ACCESS_TOKEN: "token",
      META_WA_PHONE_NUMBER_ID: "phone-id",
      META_WA_WABA_ID: "waba-id",
      META_WA_APP_SECRET: "app-secret",
      META_WA_VERIFY_TOKEN: "verify-token",
      META_WA_AUTH_TEMPLATE_NAME: "adoce_codigo_acesso",
      META_WA_GRAPH_API_VERSION: "v24.0",
    };
    const config = readMetaWhatsAppConfig((name) => values[name]);
    expect(config.templateLanguage).toBe("pt_BR");
    expect(config.accessToken).toBe("token");
  });
});
