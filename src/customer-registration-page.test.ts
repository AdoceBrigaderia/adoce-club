import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  new URL("./CustomerRegistrationPage.tsx", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const service = readFileSync(
  new URL("./services/whatsapp-otp.ts", import.meta.url),
  "utf8",
);

describe("cadastro simplificado do Clube Adoce", () => {
  it("usa um único aceite legal obrigatório e marketing opcional", () => {
    expect(page).toContain("checked={legalAccepted}");
    expect(page).toContain("Termos do Clube");
    expect(page).toContain("Política de Privacidade");
    expect(page).toContain("checked={marketingAccepted}");
    expect(page).toContain("Opcional");
    expect(page.match(/type=\"checkbox\"/g)).toHaveLength(2);
  });

  it("normaliza o nome antes de criar o cadastro", () => {
    expect(page).toContain("normalizeCustomerName(name)");
    expect(page).toContain("data-person-name=\"true\"");
    expect(page).toContain("full_name: normalizedName");
  });

  it("prioriza OTP automático do WhatsApp com fallback por e-mail", () => {
    expect(page).toContain("requestAutomaticWhatsAppOtp");
    expect(page).toContain("verifyAutomaticWhatsAppOtp");
    expect(page).toContain("Continuar pelo e-mail");
    expect(service).toContain('fetch("/api/whatsapp-otp-request"');
    expect(service).toContain('fetch("/api/whatsapp-otp-verify"');
  });

  it("vincula a validação confirmada ao perfil autenticado", () => {
    expect(page).toContain("claimVerifiedWhatsAppRegistration(challengeId)");
    expect(service).toContain(
      '"customer_claim_verified_whatsapp_registration"',
    );
  });

  it("possui rota própria sem carregar o cadastro antigo", () => {
    expect(app).toContain("CustomerRegistrationPage");
    expect(app).toContain('location.hash.startsWith("#cadastro")');
    const registrationRoute = app.indexOf(
      'location.hash.startsWith("#cadastro")',
    );
    const accessRoute = app.indexOf('host.startsWith("clube.")');
    expect(registrationRoute).toBeGreaterThan(-1);
    expect(registrationRoute).toBeLessThan(accessRoute);
  });
});
