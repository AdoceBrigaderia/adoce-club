import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  buildAuthenticationTemplatePayload,
  extractMetaMessageStatuses,
  normalizeMetaGraphVersion,
  sendAuthenticationTemplate,
  verifyMetaWebhookSignature,
} from "./meta-whatsapp";

const config = {
  accessToken: "secret-token",
  phoneNumberId: "123456789",
  wabaId: "987654321",
  appSecret: "app-secret",
  verifyToken: "verify-token",
  templateName: "adoce_codigo_acesso",
  graphApiVersion: "v24.0",
};

describe("adapter Meta WhatsApp", () => {
  it("monta template de autenticação com corpo e botão usando o mesmo OTP", () => {
    const payload = buildAuthenticationTemplatePayload(
      "+55 (85) 98215-6026",
      "428731",
      config.templateName,
    );
    expect(payload.to).toBe("5585982156026");
    expect(payload.template.components[0].parameters[0].text).toBe("428731");
    expect(payload.template.components[1].parameters[0].text).toBe("428731");
    expect(payload.template.components[1].sub_type).toBe("url");
  });

  it("recusa versão Graph API e código inválidos", () => {
    expect(() => normalizeMetaGraphVersion("latest")).toThrow(/inválida/);
    expect(() =>
      buildAuthenticationTemplatePayload("85982156026", "123", config.templateName),
    ).toThrow(/OTP inválido/);
  });

  it("envia pelo endpoint oficial e retorna o wamid", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.TESTE" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const result = await sendAuthenticationTemplate(
      config,
      "85982156026",
      "428731",
      fetchMock as typeof fetch,
    );
    expect(result.messageId).toBe("wamid.TESTE");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://graph.facebook.com/v24.0/123456789/messages",
    );
  });

  it("valida assinatura x-hub-signature-256 em tempo constante", () => {
    const rawBody = JSON.stringify({ object: "whatsapp_business_account" });
    const signature = `sha256=${createHmac("sha256", config.appSecret)
      .update(rawBody)
      .digest("hex")}`;
    expect(verifyMetaWebhookSignature(rawBody, signature, config.appSecret)).toBe(true);
    expect(verifyMetaWebhookSignature(rawBody + "x", signature, config.appSecret)).toBe(false);
  });

  it("extrai status de entrega e falha sem confiar em campos externos", () => {
    const statuses = extractMetaMessageStatuses({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: "wamid.1",
                    status: "delivered",
                    timestamp: "1770000000",
                    recipient_id: "5585999999999",
                  },
                  {
                    id: "wamid.2",
                    status: "failed",
                    errors: [{ code: 131026, title: "Message undeliverable" }],
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(statuses).toHaveLength(2);
    expect(statuses[0]).toMatchObject({ messageId: "wamid.1", status: "delivered" });
    expect(statuses[1]).toMatchObject({
      messageId: "wamid.2",
      status: "failed",
      errorCode: "131026",
    });
  });
});
