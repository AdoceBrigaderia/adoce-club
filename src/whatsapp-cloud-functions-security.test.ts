import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const requestSource = readFileSync(
  new URL("../netlify/functions/whatsapp-otp-request.ts", import.meta.url),
  "utf8",
);
const verifySource = readFileSync(
  new URL("../netlify/functions/whatsapp-otp-verify.ts", import.meta.url),
  "utf8",
);
const webhookSource = readFileSync(
  new URL("../netlify/functions/whatsapp-cloud-webhook.ts", import.meta.url),
  "utf8",
);

describe("funções do WhatsApp automático", () => {
  it("não devolve o código OTP nem segredos ao navegador", () => {
    expect(requestSource).toContain("generateWhatsAppOtp");
    expect(requestSource).toContain("hashWhatsAppOtp");
    expect(requestSource).not.toContain("verificationCode: code");
    expect(requestSource).not.toContain("accessToken:");
    expect(verifySource).not.toContain("codeHash:");
  });

  it("usa resposta genérica e rate limit", () => {
    expect(requestSource).toContain("Muitas tentativas");
    expect(requestSource).toContain("accepted: true");
    expect(requestSource).toContain("idempotencyKey");
    expect(requestSource).toContain("x-nf-client-connection-ip");
  });

  it("valida origem nas rotas públicas", () => {
    expect(requestSource).toContain("allowedOrigin(request");
    expect(verifySource).toContain("allowedOrigin(request");
  });

  it("valida assinatura do webhook antes de interpretar JSON", () => {
    expect(webhookSource).toContain("x-hub-signature-256");
    expect(webhookSource).toContain("verifyMetaWebhookSignature");
    expect(webhookSource.indexOf("verifyMetaWebhookSignature")).toBeLessThan(
      webhookSource.indexOf("JSON.parse(rawBody)"),
    );
    expect(webhookSource).toContain("META_WA_VERIFY_TOKEN");
  });

  it("registra status enviado, entregue, lido e falho", () => {
    expect(webhookSource).toContain("server_update_whatsapp_auth_delivery");
    expect(webhookSource).toContain("status.errorCode");
    expect(webhookSource).toContain("status.errorTitle");
  });
});
