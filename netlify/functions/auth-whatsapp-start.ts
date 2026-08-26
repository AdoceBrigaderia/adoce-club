import {
  allowedOrigin,
  authorizeWhatsAppRequest,
  clientIp,
  consumeRateLimit,
  env,
  hmacHex,
  isValidFullName,
  isUuid,
  json,
  maskPhone,
  normalizeBrazilPhone,
  serviceClient,
  whatsappAuthEnabled,
} from "./_shared/whatsapp-auth";

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);
  if (!whatsappAuthEnabled())
    return json({ error: "Acesso por WhatsApp ainda não está habilitado." }, 503);

  const idempotencyKey = request.headers.get("idempotency-key") || "";
  if (!isUuid(idempotencyKey))
    return json({ error: "Identificador da solicitação inválido." }, 400);

  const body = (await request.json().catch(() => ({}))) as {
    phone?: string;
    fullName?: string;
    intent?: string;
  };
  const phone = normalizeBrazilPhone(body.phone || "");
  const fullName = body.fullName?.trim().replace(/\s+/g, " ") || "";
  if (!phone) return json({ error: "Informe um WhatsApp com DDD." }, 400);
  if (!isValidFullName(fullName))
    return json({ error: "Informe seu nome e sobrenome." }, 400);
  if (body.intent && body.intent !== "signup_or_login")
    return json({ error: "Finalidade de acesso inválida." }, 400);

  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  const admin = serviceClient();
  if (!publishableKey || !supabaseUrl || !hmacSecret || !admin)
    return json({ error: "Acesso por WhatsApp não configurado no servidor." }, 503);

  const authorization = await authorizeWhatsAppRequest(request, admin);
  if (authorization.errorResponse) return authorization.errorResponse;

  try {
    const ip = clientIp(request);
    const phoneHash = await hmacHex(hmacSecret, `phone:${phone}`);
    const ipHash = await hmacHex(hmacSecret, `ip:${ip}`);
    const idempotencyHash = await hmacHex(hmacSecret, `idempotency:${idempotencyKey}`);
    const idempotency = await consumeRateLimit(
      admin,
      "whatsapp_auth:idempotency",
      idempotencyHash,
      86400,
      1,
    );
    if (!idempotency.allowed) {
      return json(
        {
          sent: true,
          duplicate: true,
          request_id: idempotencyKey,
          challenge_id: idempotencyKey,
          masked_phone: maskPhone(phone),
          expires_in: 600,
          resend_after: 60,
          next: "verify",
        },
        202,
      );
    }

    const [phoneLimit, ipLimit] = await Promise.all([
      consumeRateLimit(admin, "whatsapp_auth:start:phone", phoneHash, 900, 3),
      consumeRateLimit(admin, "whatsapp_auth:start:ip", ipHash, 900, 20),
    ]);
    const retryAfter = Math.max(
      phoneLimit.retry_after_seconds || 0,
      ipLimit.retry_after_seconds || 0,
    );
    if (!phoneLimit.allowed || !ipLimit.allowed)
      return json(
        {
          error: "Muitas solicitações. Aguarde antes de pedir outro código.",
          retry_after: retryAfter,
          request_id: idempotencyKey,
        },
        429,
        { "Retry-After": String(Math.max(retryAfter, 1)) },
      );

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: requestError } = await admin.rpc(
      "server_register_whatsapp_auth_request",
      {
        requested_id: idempotencyKey,
        requested_phone_hmac: phoneHash,
        requested_expires_at: expiresAt,
        requested_actor_user_id: authorization.actorUserId,
      },
    );
    if (requestError) throw new Error("auth_request_unavailable");

    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/otp`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
        ...(ip !== "unknown" ? { "X-Forwarded-For": ip } : {}),
      },
      body: JSON.stringify({
        phone,
        create_user: true,
        data: {
          full_name: fullName,
          auth_source: authorization.pilot
            ? "whatsapp_hook_pilot_v1"
            : "whatsapp_hook_v1",
          auth_challenge_id: idempotencyKey,
        },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (response.status === 429)
      return json(
        {
          error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
          request_id: idempotencyKey,
        },
        429,
      );
    if (!response.ok)
      return json(
        { error: "Não foi possível enviar o código agora.", request_id: idempotencyKey },
        502,
      );

    return json(
      {
        sent: true,
        request_id: idempotencyKey,
        challenge_id: idempotencyKey,
        masked_phone: maskPhone(phone),
        expires_in: 600,
        resend_after: 60,
        next: "verify",
      },
      202,
    );
  } catch {
    return json(
      { error: "O serviço de acesso demorou a responder. Tente novamente." },
      503,
    );
  }
};

export const config = { path: "/api/auth/whatsapp/start", timeout: 26 };
