import {
  allowedOrigin,
  clientIp,
  consumeRateLimit,
  env,
  hmacHex,
  json,
  serviceClient,
} from "./_shared/whatsapp-auth";

export default async (request: Request) => {
  if (request.method !== "POST")
    return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request))
    return json({ error: "Origem não autorizada." }, 403);

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    token?: string;
  };
  const email = (body.email || "").trim().toLowerCase();
  const token = (body.token || "").replace(/\D/g, "");
  if (!/^\S+@\S+\.\S+$/.test(email) || token.length !== 6)
    return json({ error: "Informe o e-mail e o código de 6 números." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  const rateLimitClient = hmacSecret ? serviceClient() : null;
  if (!supabaseUrl || !publishableKey)
    return json({ error: "Validação temporariamente indisponível." }, 503);

  if (hmacSecret && rateLimitClient) {
    const ip = clientIp(request);
    const [emailLimit, ipLimit] = await Promise.all([
      consumeRateLimit(rateLimitClient, "verify_email_code:email", await hmacHex(hmacSecret, `email:${email}`), 600, 8),
      consumeRateLimit(rateLimitClient, "verify_email_code:ip", await hmacHex(hmacSecret, `ip:${ip}`), 600, 30),
    ]);
    const retryAfter = Math.max(emailLimit.retry_after_seconds || 0, ipLimit.retry_after_seconds || 0);
    if (!emailLimit.allowed || !ipLimit.allowed)
      return json(
        { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
        429,
        { "Retry-After": String(Math.max(retryAfter, 1)) },
      );
  }

  try {
    const types = ["email", "recovery", "magiclink"] as const;
    let lastStatus = 401;
    for (const type of types) {
      // Não repassamos o IP do cliente ao GoTrue aqui: ele conta como
      // tentativa de OTP no limite dele, e um header vindo do cliente pode
      // ser forjado para escapar desse limite.
      const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify`, {
        method: "POST",
        headers: { apikey: publishableKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, type }),
        signal: AbortSignal.timeout(20000),
      });
      const payload = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (response.ok) return json(payload);
      lastStatus = response.status;
      if (response.status === 429)
        return json(
          { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
          429,
        );
    }
    return json({ error: "Código inválido ou expirado." }, lastStatus === 429 ? 429 : 401);
  } catch {
    return json(
      { error: "O serviço de acesso demorou a responder. Tente novamente." },
      504,
    );
  }
};

export const config = { path: "/api/verify-email-code", timeout: 26 };
