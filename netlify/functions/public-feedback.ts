import {
  consumePublicRateLimits,
  ipRateLimitRule,
} from "./_shared/public-rate-limit";
import {
  ACCESS_COOKIE,
  SURFACE_COOKIE,
  allowedOrigin,
  parseCookies,
  secureJson,
} from "./_shared/session-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];
const clean = (value: unknown, max: number) =>
  String(value || "").trim().slice(0, max);
const categories = new Set([
  "problem",
  "complaint",
  "suggestion",
  "compliment",
  "privacy",
]);
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function optionalClientProfile(
  request: Request,
  supabaseUrl: string,
  publishableKey: string,
) {
  const cookies = parseCookies(request);
  if (cookies.get(SURFACE_COOKIE) !== "client") return null;
  const token = cookies.get(ACCESS_COOKIE) || "";
  if (!token) return null;
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) return null;
    const user = (await response.json().catch(() => null)) as
      | { id?: string }
      | null;
    return user?.id && UUID.test(user.id) ? user.id : null;
  } catch {
    return null;
  }
}

export default async (request: Request) => {
  if (request.method !== "POST")
    return secureJson({ error: "Método não permitido." }, 405);
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigin(request, env("SITE_URL")))
    return secureJson({ error: "Origem não autorizada." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 8_192)
    return secureJson({ error: "Mensagem maior que o permitido." }, 413);

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const operationKey = clean(body.operation_key, 36);
  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  const phone = clean(body.phone, 24);
  const phoneDigits = phone.replace(/\D/g, "");
  const category = clean(body.category, 20);
  const message = clean(body.message, 3_000);
  const pageUrl = clean(body.page_url, 500);

  if (!UUID.test(operationKey))
    return secureJson({ error: "Mensagem inválida." }, 400);
  if (name.length < 2 || message.length < 10 || !categories.has(category))
    return secureJson(
      { error: "Informe seu nome, o tipo e detalhes do que aconteceu." },
      400,
    );
  if (email && !/^\S+@\S+\.\S+$/.test(email))
    return secureJson({ error: "Informe um e-mail válido." }, 400);
  if (category === "privacy" && !email && phoneDigits.length < 10)
    return secureJson(
      {
        error:
          "Para solicitações de privacidade, informe um e-mail ou celular para retorno.",
      },
      400,
    );

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey =
    env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey)
    return secureJson({ error: "Canal temporariamente indisponível." }, 503);

  const contactSubject = phoneDigits
    ? `phone:${phoneDigits}`
    : email
      ? `email:${email}`
      : `name:${name.toLocaleLowerCase("pt-BR")}`;
  const rateLimit = await consumePublicRateLimits({
    supabaseUrl,
    secretKey,
    pepper:
      env("PUBLIC_RATE_LIMIT_PEPPER") ||
      env("WHATSAPP_OTP_PEPPER") ||
      secretKey,
    rules: [
      ipRateLimitRule(request, "feedback:ip", 3600, 10),
      {
        bucket: "feedback:contact",
        subject: contactSubject,
        windowSeconds: 3600,
        maxRequests: 5,
      },
    ],
  });
  if (!rateLimit.allowed) {
    return secureJson(
      {
        error: rateLimit.failed
          ? "Canal temporariamente indisponível."
          : "Muitas mensagens em pouco tempo. Aguarde antes de tentar novamente.",
        code: rateLimit.failed ? "rate_limit_unavailable" : "rate_limited",
        retry_after_seconds: rateLimit.retryAfterSeconds,
      },
      rateLimit.failed ? 503 : 429,
    );
  }

  const profileId = await optionalClientProfile(
    request,
    supabaseUrl,
    publishableKey,
  );
  try {
    const upstream = await fetch(
      `${supabaseUrl}/rest/v1/rpc/submit_site_feedback_bff`,
      {
        method: "POST",
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requested_operation_key: operationKey,
          requested_profile_id: profileId,
          requested_category: category,
          requested_customer_name: name,
          requested_customer_email: email || null,
          requested_customer_phone: phone || null,
          requested_page_url: pageUrl,
          requested_message: message,
        }),
      },
    );
    const payload = (await upstream.json().catch(() => null)) as
      | { protocol?: string; message?: string }
      | null;
    if (!upstream.ok || !payload?.protocol)
      return secureJson(
        {
          error:
            payload?.message ||
            "Não foi possível registrar agora. Tente novamente.",
        },
        upstream.status >= 500 ? 502 : 400,
      );
    return secureJson({ protocol: payload.protocol }, 201);
  } catch {
    return secureJson(
      { error: "Não foi possível registrar agora. Tente novamente." },
      503,
    );
  }
};

export const config = { path: "/api/public-feedback" };
