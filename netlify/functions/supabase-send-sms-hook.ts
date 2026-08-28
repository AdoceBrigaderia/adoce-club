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

  const phoneNumberId = env("META_WHATSAPP_PHONE_NUMBER_ID") || "";
  const accessToken = env("META_WHATSAPP_ACCESS_TOKEN") || "";
  const graphVersion = env("META_WHATSAPP_GRAPH_VERSION") || "";
  const templateName = env("META_WHATSAPP_AUTH_TEMPLATE") || "";
  const templateLanguage = env("META_WHATSAPP_AUTH_TEMPLATE_LANGUAGE") || "pt_BR";
  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  if (
    !phoneNumberId ||
    !accessToken ||
    !/^v\d+\.\d+$/.test(graphVersion) ||
    !templateName ||
    !hmacSecret
  )
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
    const response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone.replace(/\D/g, ""),
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: otp }],
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: otp }],
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const metaPayload = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { code?: number; error_subcode?: number };
    };
    const providerMessageId = metaPayload.messages?.[0]?.id || null;
    if (admin) {
      const { error } = await admin.rpc("server_record_whatsapp_auth_delivery", {
        requested_request_id: request.headers.get("webhook-id") || crypto.randomUUID(),
        requested_phone_hmac: phoneHash,
        requested_phone_last4: phone.slice(-4),
        requested_provider_message_id: providerMessageId || "",
        requested_template_name: templateName,
        requested_status: response.ok && providerMessageId ? "accepted" : "failed",
        requested_error_code: response.ok
          ? ""
          : String(metaPayload.error?.error_subcode || metaPayload.error?.code || "meta_error"),
        requested_latency_ms: Date.now() - startedAt,
      });
      if (error) console.error("whatsapp auth delivery audit failed", error.code);
    }
    if (!response.ok || !providerMessageId)
      return json({ error: "O WhatsApp recusou a mensagem." }, 502);
    return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return json({ error: "O WhatsApp demorou a responder." }, 504);
  }
};

export const config = { path: "/api/hooks/supabase/send-sms", timeout: 20 };
