import {
  allowedOrigin,
  authorizeWhatsAppRequest,
  clientIp,
  consumeRateLimit,
  env,
  hmacHex,
  isUuid,
  json,
  normalizeBrazilPhone,
  serviceClient,
  whatsappAuthEnabled,
} from "./_shared/whatsapp-auth";

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);
  if (!whatsappAuthEnabled())
    return json({ error: "Acesso por WhatsApp ainda não está habilitado." }, 503);

  const body = (await request.json().catch(() => ({}))) as {
    challengeId?: string;
    challenge_id?: string;
    phone?: string;
    code?: string;
  };
  const challengeId = body.challengeId || body.challenge_id || "";
  const phone = normalizeBrazilPhone(body.phone || "");
  const code = (body.code || "").replace(/\D/g, "");
  if (!phone || code.length !== 6 || !isUuid(challengeId))
    return json({ error: "Informe o WhatsApp e o código de 6 números." }, 400);

  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  const admin = serviceClient();
  if (!publishableKey || !supabaseUrl || !hmacSecret || !admin)
    return json({ error: "Validação por WhatsApp não configurada no servidor." }, 503);

  const authorization = await authorizeWhatsAppRequest(request, admin);
  if (authorization.errorResponse) return authorization.errorResponse;

  try {
    const ip = clientIp(request);
    const phoneHash = await hmacHex(hmacSecret, `phone:${phone}`);
    const ipHash = await hmacHex(hmacSecret, `ip:${ip}`);
    const [phoneLimit, ipLimit] = await Promise.all([
      consumeRateLimit(admin, "whatsapp_auth:verify:phone", phoneHash, 600, 5),
      consumeRateLimit(admin, "whatsapp_auth:verify:ip", ipHash, 600, 30),
    ]);
    const retryAfter = Math.max(
      phoneLimit.retry_after_seconds || 0,
      ipLimit.retry_after_seconds || 0,
    );
    if (!phoneLimit.allowed || !ipLimit.allowed)
      return json(
        {
          error: "Muitas tentativas. Aguarde antes de tentar novamente.",
          retry_after: retryAfter,
          request_id: challengeId,
        },
        429,
        { "Retry-After": String(Math.max(retryAfter, 1)) },
      );

    const { data: validRequest, error: requestError } = await admin.rpc(
      "server_check_whatsapp_auth_request",
      {
        requested_id: challengeId,
        requested_phone_hmac: phoneHash,
        mark_verified: false,
      },
    );
    if (requestError || validRequest !== true)
      return json({ error: "Código inválido ou expirado." }, 401);

    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
        ...(ip !== "unknown" ? { "X-Forwarded-For": ip } : {}),
      },
      body: JSON.stringify({ phone, token: code, type: "sms" }),
      signal: AbortSignal.timeout(20000),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (response.status === 429)
      return json({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429);
    if (!response.ok)
      return json(
        { error: "Código inválido ou expirado.", request_id: challengeId },
        401,
      );

    const { error: markError } = await admin.rpc("server_check_whatsapp_auth_request", {
      requested_id: challengeId,
      requested_phone_hmac: phoneHash,
      mark_verified: true,
    });
    if (markError) console.error("whatsapp auth request audit failed", markError.code);

    const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
    const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : "";
    if (!accessToken || !refreshToken)
      return json({ error: "Não foi possível criar a sessão." }, 502);
    if (authorization.pilot) {
      return json({
        request_id: challengeId,
        verified: true,
        next: "pilot_complete",
      });
    }
    return json({
      request_id: challengeId,
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: typeof payload.expires_in === "number" ? payload.expires_in : 3600,
      },
      profile_state: "pending_or_complete",
      next: "club_card",
    });
  } catch {
    return json(
      { error: "O serviço de validação demorou a responder. Tente novamente." },
      504,
    );
  }
};

export const config = { path: "/api/auth/whatsapp/verify", timeout: 26 };
