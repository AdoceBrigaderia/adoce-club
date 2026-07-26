import { createClient } from "@supabase/supabase-js";
import {
  ACCESS_COOKIE,
  allowedOrigin,
  parseCookies,
  secureJson,
  sessionCookies,
  validCsrf,
  type AuthSurface,
  type SupabaseTokenPayload,
} from "./_shared/session-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

type PasskeyFinishApi = {
  verifyAuthentication: (input: {
    challengeId: string;
    credential: unknown;
  }) => Promise<{
    data: { session?: SupabaseTokenPayload; user?: { id?: string; email?: string | null } } | null;
    error: { message?: string; code?: string } | null;
  }>;
  verifyRegistration: (input: {
    challengeId: string;
    credential: unknown;
  }) => Promise<{
    data: { id?: string; friendly_name?: string; created_at?: string } | null;
    error: { message?: string; code?: string } | null;
  }>;
};

function passkeyApi(client: ReturnType<typeof createClient>) {
  return (client.auth as unknown as { passkey: PasskeyFinishApi }).passkey;
}

export default async (request: Request) => {
  if (request.method !== "POST")
    return secureJson({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request, env("SITE_URL")))
    return secureJson({ error: "Origem não autorizada." }, 403);

  const body = (await request.json().catch(() => ({}))) as {
    action?: "authentication" | "registration";
    challengeId?: string;
    credential?: unknown;
    surface?: AuthSurface;
    remember?: boolean;
  };
  const action = body.action;
  const challengeId = body.challengeId?.trim() || "";
  const surface: AuthSurface = body.surface === "operation" ? "operation" : "client";
  if (!action || !challengeId || !body.credential)
    return secureJson({ error: "Resposta da chave de acesso incompleta." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey)
    return secureJson({ error: "Chaves de acesso indisponíveis neste ambiente." }, 503);

  if (action === "registration") {
    if (!validCsrf(request))
      return secureJson({ error: "Validação CSRF inválida." }, 403);
    const accessToken = parseCookies(request).get(ACCESS_COOKIE) || "";
    if (!accessToken)
      return secureJson({ error: "Entre antes de cadastrar uma chave de acesso." }, 401);

    const client = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        experimental: { passkey: true },
      },
    });
    const result = await passkeyApi(client).verifyRegistration({
      challengeId,
      credential: body.credential,
    });
    if (result.error || !result.data?.id)
      return secureJson(
        {
          error: result.error?.message || "Não foi possível cadastrar a chave de acesso.",
          code: result.error?.code || "passkey_registration_failed",
        },
        400,
      );
    return secureJson({ registered: true, passkey: result.data });
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      experimental: { passkey: true },
    },
  });
  const result = await passkeyApi(client).verifyAuthentication({
    challengeId,
    credential: body.credential,
  });
  const tokens = result.data?.session;
  const userId = result.data?.user?.id;
  if (result.error || !tokens?.access_token || !tokens.refresh_token || !userId)
    return secureJson(
      {
        error: result.error?.message || "Biometria ou chave de acesso não reconhecida.",
        code: result.error?.code || "passkey_authentication_failed",
      },
      401,
    );

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin
    .from("profiles")
    .select("id,full_name,phone_e164,active,account_status,must_change_password,temporary_password_expires_at")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.id || !profile.active || profile.account_status !== "active")
    return secureJson({ error: "Conta indisponível." }, 403);

  let role = "customer";
  let mustChangePassword = Boolean(profile.must_change_password);
  let temporaryPasswordExpiresAt = profile.temporary_password_expires_at || null;
  if (surface === "operation") {
    const { data: staff } = await admin
      .from("staff_members")
      .select("role,active,must_change_password,temporary_password_expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!staff?.active)
      return secureJson({ error: "Esta chave não possui acesso à operação." }, 403);
    role = staff.role;
    mustChangePassword = Boolean(staff.must_change_password);
    temporaryPasswordExpiresAt = staff.temporary_password_expires_at || null;
  }

  const cookieSession = sessionCookies(tokens, surface, body.remember !== false);
  return secureJson(
    {
      authenticated: true,
      user: {
        id: userId,
        email: result.data?.user?.email || null,
        fullName: profile.full_name || "",
        phone: profile.phone_e164 || null,
        surface,
        role,
      },
      mustChangePassword,
      temporaryPasswordExpiresAt,
      csrfToken: cookieSession.csrfToken,
    },
    200,
    cookieSession.values,
  );
};

export const config = { path: "/api/auth-bff-passkey-finish" };
