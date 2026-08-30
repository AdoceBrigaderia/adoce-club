import { createClient } from "@supabase/supabase-js";
import {
  consumeRateLimit,
  hmacHex,
  normalizeBrazilPhone,
  whatsappAuthEnabled,
} from "./_shared/whatsapp-auth";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });

const allowedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const configured = env("SITE_URL")?.replace(/\/$/, "");
  return new Set(
    [
      configured,
      "https://www.adocebrigaderia.com.br",
      "https://adocebrigaderia.com.br",
      "https://clube.adocebrigaderia.com.br",
      "https://operacao.adocebrigaderia.com.br",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4182",
      "http://127.0.0.1:4182",
    ].filter(Boolean),
  ).has(origin);
};

const maskPhone = (phone: string) =>
  `+55 •• •••••-${phone.replace(/\D/g, "").slice(-4)}`;

const clientIp = (request: Request) =>
  request.headers.get("x-nf-client-connection-ip") ||
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "unknown";

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);
  if (!whatsappAuthEnabled())
    return json({ error: "Recuperação por WhatsApp temporariamente indisponível." }, 503);

  const idempotencyKey = request.headers.get("idempotency-key") || crypto.randomUUID();

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    phone?: string;
  };
  const emailInput = (body.email || "").trim().toLowerCase();
  const phoneInput = body.phone ? normalizeBrazilPhone(body.phone) : null;
  if (!emailInput && !phoneInput) {
    return json({ error: "Informe o WhatsApp ou o e-mail da conta." }, 400);
  }

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  if (!supabaseUrl || !publishableKey || !secretKey || !hmacSecret) {
    return json({ error: "Recuperação temporariamente indisponível." }, 503);
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const profileQuery = phoneInput
    ? admin
        .from("profiles")
        .select("id,full_name,phone_e164,active,account_status")
        .eq("phone_e164", phoneInput)
        .maybeSingle()
    : admin
        .from("profiles")
        .select("id,full_name,phone_e164,active,account_status")
        .eq("email", emailInput)
        .maybeSingle();
  const { data: profile } = await profileQuery;
  if (!profile?.active || profile.account_status !== "active" || !profile.phone_e164) {
    return json(
      {
        error: phoneInput
          ? "Não encontramos uma conta ativa com este WhatsApp."
          : "Não encontramos um WhatsApp cadastrado para este e-mail. Fale com a loja para atualizar seu cadastro.",
      },
      404,
    );
  }
  const phone = phoneInput || profile.phone_e164;
  const fullName = (profile.full_name || "").trim() || "Cliente Adoce";

  try {
    const ip = clientIp(request);
    const phoneHash = await hmacHex(hmacSecret, `phone:${phone}`);
    const ipHash = await hmacHex(hmacSecret, `ip:${ip}`);
    const idempotencyHash = await hmacHex(hmacSecret, `idempotency:${idempotencyKey}`);
    const idempotency = await consumeRateLimit(
      admin,
      "whatsapp_auth:reset:idempotency",
      idempotencyHash,
      86400,
      1,
    );
    if (!idempotency.allowed) {
      return json({ sent: true, duplicate: true, masked_phone: maskPhone(phone) }, 202);
    }

    const [phoneLimit, ipLimit] = await Promise.all([
      consumeRateLimit(admin, "whatsapp_auth:reset:phone", phoneHash, 900, 3),
      consumeRateLimit(admin, "whatsapp_auth:reset:ip", ipHash, 900, 20),
    ]);
    const retryAfter = Math.max(
      phoneLimit.retry_after_seconds || 0,
      ipLimit.retry_after_seconds || 0,
    );
    if (!phoneLimit.allowed || !ipLimit.allowed)
      return json(
        {
          error: "Muitas tentativas. Aguarde antes de pedir outro código.",
          retry_after: retryAfter,
        },
        429,
        { "Retry-After": String(Math.max(retryAfter, 1)) },
      );

    // Garante que a identidade do Supabase reconhece este telefone como o
    // mesmo já cadastrado, em vez de criar uma conta paralela ao verificar o OTP.
    const { data: userData } = await admin.auth.admin.getUserById(profile.id);
    if (userData.user?.phone !== phone.replace(/^\+/, "")) {
      const { error: linkError } = await admin.auth.admin.updateUserById(profile.id, {
        phone,
        phone_confirm: true,
      });
      if (linkError && !/already registered|already exists/i.test(linkError.message)) {
        console.error("request-password-reset phone link", linkError);
        return json({ error: "Não foi possível preparar a recuperação agora." }, 502);
      }
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: requestError } = await admin.rpc(
      "server_register_whatsapp_auth_request",
      {
        requested_id: idempotencyKey,
        requested_phone_hmac: phoneHash,
        requested_expires_at: expiresAt,
        requested_actor_user_id: null,
      },
    );
    if (requestError) throw new Error("auth_request_unavailable");

    // Marca a troca de senha como obrigatória assim que a pessoa entrar de
    // novo - reaproveita a mesma tela já usada quando um gerente reseta senha.
    await admin.from("profiles").update({ must_change_password: true }).eq("id", profile.id);
    await admin
      .from("staff_members")
      .update({ must_change_password: true })
      .eq("user_id", profile.id);

    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/otp`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
        ...(ip !== "unknown" ? { "X-Forwarded-For": ip } : {}),
      },
      body: JSON.stringify({
        phone,
        create_user: false,
        data: {
          full_name: fullName,
          auth_source: "password_reset_v1",
          auth_challenge_id: idempotencyKey,
        },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 429)
      return json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, 429);
    if (!response.ok)
      return json({ error: "Não foi possível enviar o código agora." }, 502);

    return json({
      sent: true,
      channel: "whatsapp",
      request_id: idempotencyKey,
      masked_phone: maskPhone(phone),
    });
  } catch (error) {
    console.error("request-password-reset", error);
    return json(
      { error: "Não foi possível enviar o acesso agora. Tente de novo em alguns segundos." },
      502,
    );
  }
};

export const config = { path: "/api/request-password-reset", timeout: 26 };
