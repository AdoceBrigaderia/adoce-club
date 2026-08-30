import {
  env,
  hmacHex,
  json,
  normalizeBrazilPhone,
  serviceClient,
  verifyStandardWebhook,
  whatsappAuthEnabled,
} from "./_shared/whatsapp-auth";

type SendSmsHookPayload = {
  user?: { phone?: string };
  sms?: { otp?: string };
};

const MAX_HOOK_BYTES = 32768;

const asWhatsAppAddress = (value: string) =>
  value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!whatsappAuthEnabled()) return json({ error: "Integração desativada." }, 503);

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > MAX_HOOK_BYTES) return json({ error: "Payload muito grande." }, 413);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_HOOK_BYTES)
    return json({ error: "Payload muito grande." }, 413);

  const hookSecret = env("SUPABASE_SEND_SMS_HOOK_SECRET") || "";
  if (!hookSecret || !(await verifyStandardWebhook(rawBody, request.headers, hookSecret)))
    return json({ error: "Assinatura inválida." }, 401);

  let payload: SendSmsHookPayload;
  try {
    payload = JSON.parse(rawBody) as SendSmsHookPayload;
  } catch {
    return json({ error: "Evento inválido." }, 400);
  }
  const phone = normalizeBrazilPhone(payload.user?.phone || "");
  const otp = (payload.sms?.otp || "").replace(/\D/g, "");
  if (!phone || otp.length !== 6) return json({ error: "Evento inválido." }, 400);

  const accountSid = env("TWILIO_ACCOUNT_SID") || "";
  const authToken = env("TWILIO_AUTH_TOKEN") || "";
  const whatsappFrom = env("TWILIO_WHATSAPP_FROM") || "";
  const contentSid = env("TWILIO_CONTENT_SID") || "";
  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  if (!accountSid || !authToken || !whatsappFrom || !contentSid || !hmacSecret)
    return json({ error: "Provedor não configurado." }, 503);

  const admin = serviceClient();
  if (!admin) return json({ error: "Auditoria não configurada." }, 503);
  const phoneHash = await hmacHex(hmacSecret, `phone:${phone}`);
  const { data: pendingRequest, error: pendingError } = await admin.rpc(
    "server_has_pending_whatsapp_auth_request",
    { requested_phone_hmac: phoneHash },
  );
  if (pendingError || pendingRequest !== true)
    return json({ error: "Solicitação não autorizada ou expirada." }, 403);

  const startedAt = Date.now();
  try {
    const form = new URLSearchParams({
      To: asWhatsAppAddress(phone),
      From: asWhatsAppAddress(whatsappFrom),
      ContentSid: contentSid,
      ContentVariables: JSON.stringify({ "1": otp }),
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal: AbortSignal.timeout(15000),
      },
    );
    const twilioPayload = (await response.json().catch(() => ({}))) as {
      sid?: string;
      status?: string;
      code?: number;
      message?: string;
    };
    const providerMessageId = twilioPayload.sid || null;
    const delivered = response.ok && Boolean(providerMessageId) && twilioPayload.status !== "failed";
    if (admin) {
      const { error } = await admin.rpc("server_record_whatsapp_auth_delivery", {
        requested_request_id: request.headers.get("webhook-id") || crypto.randomUUID(),
        requested_phone_hmac: phoneHash,
        requested_phone_last4: phone.slice(-4),
        requested_provider_message_id: providerMessageId || "",
        requested_template_name: contentSid,
        requested_status: delivered ? "accepted" : "failed",
        requested_error_code: delivered ? "" : String(twilioPayload.code || "twilio_error"),
        requested_latency_ms: Date.now() - startedAt,
      });
      if (error) console.error("whatsapp auth delivery audit failed", error.code);
    }
    if (!delivered) {
      console.error(
        "supabase-send-sms-hook twilio",
        response.status,
        JSON.stringify(twilioPayload),
      );
      return json({ error: "O WhatsApp recusou a mensagem." }, 502);
    }
    return json({}, 200);
  } catch {
    return json({ error: "O WhatsApp demorou a responder." }, 504);
  }
};

export const config = { path: "/api/hooks/supabase/send-sms", timeout: 20 };
