import { createHmac, timingSafeEqual } from "node:crypto";

export type MetaWhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  appSecret: string;
  verifyToken: string;
  templateName: string;
  graphApiVersion: string;
  templateLanguage?: string;
};

export type MetaMessageStatus = {
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed" | "deleted" | "unknown";
  timestamp: string | null;
  recipientId: string | null;
  errorCode: string | null;
  errorTitle: string | null;
};

export function normalizeMetaGraphVersion(value: string) {
  const normalized = value.trim();
  if (!/^v\d{1,2}\.\d{1,2}$/.test(normalized)) {
    throw new Error("META_WA_GRAPH_API_VERSION inválida.");
  }
  return normalized;
}

export function normalizeWhatsAppRecipient(value: string) {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  if (national.length !== 10 && national.length !== 11) {
    throw new Error("Informe um WhatsApp brasileiro com DDD.");
  }
  return `55${national}`;
}

export function buildAuthenticationTemplatePayload(
  recipient: string,
  code: string,
  templateName: string,
  language = "pt_BR",
) {
  if (!/^\d{6}$/.test(code)) throw new Error("Código OTP inválido.");
  if (!/^[a-z0-9_]{1,512}$/.test(templateName)) {
    throw new Error("Nome do template de autenticação inválido.");
  }

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizeWhatsAppRecipient(recipient),
    type: "template",
    template: {
      name: templateName,
      language: { policy: "deterministic", code: language },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: code }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: code }],
        },
      ],
    },
  } as const;
}

export async function sendAuthenticationTemplate(
  config: MetaWhatsAppConfig,
  recipient: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
) {
  const version = normalizeMetaGraphVersion(config.graphApiVersion);
  const response = await fetchImpl(
    `https://graph.facebook.com/${version}/${encodeURIComponent(config.phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildAuthenticationTemplatePayload(
          recipient,
          code,
          config.templateName,
          config.templateLanguage || "pt_BR",
        ),
      ),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
    error?: { code?: number; message?: string; error_user_msg?: string };
  };

  const messageId = payload.messages?.[0]?.id || "";
  if (!response.ok || !messageId) {
    const error = new Error(
      payload.error?.error_user_msg ||
        payload.error?.message ||
        "A Meta não aceitou o envio do código.",
    ) as Error & { providerCode?: string; httpStatus?: number };
    error.providerCode = payload.error?.code ? String(payload.error.code) : undefined;
    error.httpStatus = response.status;
    throw error;
  }

  return { messageId };
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
) {
  if (!signatureHeader?.startsWith("sha256=") || !appSecret) return false;
  const suppliedHex = signatureHeader.slice("sha256=".length);
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;
  const expectedHex = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const supplied = Buffer.from(suppliedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function extractMetaMessageStatuses(payload: unknown): MetaMessageStatus[] {
  const body = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          statuses?: Array<{
            id?: string;
            status?: string;
            timestamp?: string;
            recipient_id?: string;
            errors?: Array<{ code?: number; title?: string; message?: string }>;
          }>;
        };
      }>;
    }>;
  };

  return (body.entry || []).flatMap((entry) =>
    (entry.changes || []).flatMap((change) =>
      (change.value?.statuses || [])
        .filter((status) => Boolean(status.id))
        .map((status) => {
          const accepted = new Set(["sent", "delivered", "read", "failed", "deleted"]);
          const normalizedStatus = accepted.has(status.status || "")
            ? (status.status as MetaMessageStatus["status"])
            : "unknown";
          const providerError = status.errors?.[0];
          return {
            messageId: status.id || "",
            status: normalizedStatus,
            timestamp: status.timestamp || null,
            recipientId: status.recipient_id || null,
            errorCode: providerError?.code ? String(providerError.code) : null,
            errorTitle: providerError?.title || providerError?.message || null,
          };
        }),
    ),
  );
}
