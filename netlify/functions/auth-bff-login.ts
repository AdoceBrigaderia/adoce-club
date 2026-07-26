import { createClient } from "@supabase/supabase-js";
import {
  allowedOrigin,
  secureJson,
  sessionCookies,
  type AuthSurface,
  type SupabaseTokenPayload,
} from "./_shared/session-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  return national.length === 10 || national.length === 11
    ? `+55${national}`
    : null;
};

const expiredTemporaryPassword = (
  mustChangePassword: boolean,
  expiresAt: string | null | undefined,
) => mustChangePassword && (!expiresAt || Date.parse(expiresAt) <= Date.now());

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
    return secureJson({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request, env("SITE_URL")))
    return secureJson({ error: "Origem não autorizada." }, 403);

  const body = (await request.json().catch(() => ({}))) as {
    phone?: string;
    password?: string;
    surface?: AuthSurface;
    remember?: boolean;
  };
  const phone = normalizePhone(body.phone || "");
  const password = body.password || "";
  const surface: AuthSurface = body.surface === "operation" ? "operation" : "client";
  if (!phone || !password)
    return secureJson({ error: "Informe celular e senha." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") ||
    env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey =
    env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey)
    return secureJson({ error: "Acesso temporariamente indisponível." }, 503);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id,active,account_status,auth_upgraded_at,must_change_password,temporary_password_expires_at",
    )
    .eq("phone_e164", phone)
    .maybeSingle();

  if (!profile?.id || !profile.active || profile.account_status !== "active")
    return secureJson({ error: "Celular ou senha incorretos." }, 401);
  if (surface === "client" && !profile.auth_upgraded_at)
    return secureJson({ error: "Celular ou senha incorretos." }, 401);

  let staff:
    | {
        role?: string;
        active?: boolean;
        must_change_password?: boolean;
        temporary_password_expires_at?: string | null;
      }
    | null = null;
  if (surface === "operation") {
    const result = await admin
      .from("staff_members")
      .select(
        "role,active,must_change_password,temporary_password_expires_at",
      )
      .eq("user_id", profile.id)
      .maybeSingle();
    staff = result.data;
    if (!staff?.active)
      return secureJson({ error: "Celular ou senha incorretos." }, 401);
  }

  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(profile.id);
  const email = userData.user?.email;
  if (userError || !email)
    return secureJson({ error: "Celular ou senha incorretos." }, 401);

  const forwardedIp = request.headers.get("x-nf-client-connection-ip") || "";
  const authResponse = await fetch(
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
  const tokenPayload = (await authResponse
    .json()
    .catch(() => ({}))) as Partial<SupabaseTokenPayload> & { error?: string };
  if (!authResponse.ok || !tokenPayload.access_token || !tokenPayload.refresh_token) {
    if (authResponse.status === 429)
      return secureJson(
        { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
        429,
      );
    return secureJson({ error: "Celular ou senha incorretos." }, 401);
  }

  const mustChangePassword = Boolean(
    surface === "operation"
      ? staff?.must_change_password
      : profile.must_change_password,
  );
  const temporaryPasswordExpiresAt =
    surface === "operation"
      ? staff?.temporary_password_expires_at
      : profile.temporary_password_expires_at;
  if (expiredTemporaryPassword(mustChangePassword, temporaryPasswordExpiresAt)) {
    await revokeSession(supabaseUrl, publishableKey, tokenPayload.access_token);
    return secureJson(
      {
        error:
          "A senha temporária expirou. Solicite uma nova redefinição ao responsável pela conta.",
        code: "temporary_password_expired",
      },
      403,
    );
  }

  const cookieSession = sessionCookies(
    tokenPayload as SupabaseTokenPayload,
    surface,
    body.remember !== false,
  );

  return secureJson(
    {
      authenticated: true,
      user: {
        id: profile.id,
        surface,
        role: surface === "operation" ? staff?.role || null : "customer",
      },
      csrfToken: cookieSession.csrfToken,
      mustChangePassword,
      temporaryPasswordExpiresAt: temporaryPasswordExpiresAt || null,
      expiresIn: Math.min(Number(tokenPayload.expires_in) || 900, 900),
    },
    200,
    cookieSession.values,
  );
};

export const config = { path: "/api/auth-bff-login" };
