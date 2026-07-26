import { createClient } from "@supabase/supabase-js";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const allowedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return new Set([
    "https://www.adocebrigaderia.com.br",
    "https://clube.adocebrigaderia.com.br",
    "https://operacao.adocebrigaderia.com.br",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4182",
    "http://127.0.0.1:4182",
  ]).has(origin);
};

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  return national.length === 10 || national.length === 11
    ? `+55${national}`
    : null;
};

async function revokeSession(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
) {
  await fetch(`${supabaseUrl}/auth/v1/logout?scope=global`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(() => undefined);
}

export default async (request: Request) => {
  if (request.method !== "POST")
    return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request))
    return json({ error: "Origem não autorizada." }, 403);

  const body = (await request.json().catch(() => ({}))) as {
    phone?: string;
    password?: string;
  };
  const phone = normalizePhone(body.phone || "");
  const password = body.password || "";
  if (!phone || !password)
    return json({ error: "Informe celular e senha." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") ||
    env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey =
    env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey)
    return json({ error: "Acesso temporariamente indisponível." }, 503);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin
    .from("profiles")
    .select("id,active,account_status")
    .eq("phone_e164", phone)
    .maybeSingle();
  if (!profile?.id || !profile.active || profile.account_status !== "active")
    return json({ error: "Celular ou senha incorretos." }, 401);

  const { data: staff } = await admin
    .from("staff_members")
    .select(
      "active,must_change_password,temporary_password_expires_at",
    )
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!staff?.active)
    return json({ error: "Celular ou senha incorretos." }, 401);

  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(profile.id);
  const email = userData.user?.email;
  if (userError || !email)
    return json({ error: "Celular ou senha incorretos." }, 401);

  const forwardedIp =
    request.headers.get("x-nf-client-connection-ip") || "";
  const response = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
        ...(forwardedIp ? { "X-Forwarded-For": forwardedIp } : {}),
      },
      body: JSON.stringify({ email, password }),
    },
  );
  const payload = (await response
    .json()
    .catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    if (response.status === 429)
      return json(
        {
          error:
            "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        },
        429,
      );
    return json({ error: "Celular ou senha incorretos." }, 401);
  }

  const expiresAt = staff.temporary_password_expires_at
    ? Date.parse(staff.temporary_password_expires_at)
    : Number.NaN;
  if (
    staff.must_change_password &&
    (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
  ) {
    const accessToken = typeof payload.access_token === "string"
      ? payload.access_token
      : "";
    if (accessToken)
      await revokeSession(supabaseUrl, publishableKey, accessToken);
    return json(
      {
        error:
          "A senha temporária expirou. Solicite uma nova redefinição ao responsável pela conta.",
        code: "temporary_password_expired",
      },
      403,
    );
  }

  return json({
    ...payload,
    must_change_password: Boolean(staff.must_change_password),
    temporary_password_expires_at:
      staff.temporary_password_expires_at || null,
  });
};

export const config = { path: "/api/staff-phone-login" };
