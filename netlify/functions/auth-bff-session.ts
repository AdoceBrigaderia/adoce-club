import { createClient } from "@supabase/supabase-js";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SURFACE_COOKIE,
  allowedOrigin,
  clearedSessionCookies,
  parseCookies,
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

async function refreshTokens(
  supabaseUrl: string,
  publishableKey: string,
  refreshToken: string,
) {
  const response = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  );
  const payload = (await response
    .json()
    .catch(() => ({}))) as Partial<SupabaseTokenPayload>;
  if (!response.ok || !payload.access_token || !payload.refresh_token)
    return null;
  return payload as SupabaseTokenPayload;
}

async function currentUser(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return null;
  return (await response.json().catch(() => null)) as {
    id?: string;
    email?: string | null;
  } | null;
}

export default async (request: Request) => {
  if (request.method !== "GET")
    return secureJson({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request, env("SITE_URL")))
    return secureJson({ error: "Origem não autorizada." }, 403);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") ||
    env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey =
    env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey)
    return secureJson({ error: "Sessão temporariamente indisponível." }, 503);

  const cookies = parseCookies(request);
  const refreshToken = cookies.get(REFRESH_COOKIE) || "";
  let accessToken = cookies.get(ACCESS_COOKIE) || "";
  const surface =
    cookies.get(SURFACE_COOKIE) === "operation" ? "operation" : "client";
  if (!refreshToken)
    return secureJson(
      { authenticated: false },
      401,
      clearedSessionCookies(),
    );

  let user = accessToken
    ? await currentUser(supabaseUrl, publishableKey, accessToken)
    : null;
  let rotated: SupabaseTokenPayload | null = null;
  if (!user?.id) {
    rotated = await refreshTokens(supabaseUrl, publishableKey, refreshToken);
    if (!rotated)
      return secureJson(
        { authenticated: false, code: "session_expired" },
        401,
        clearedSessionCookies(),
      );
    accessToken = rotated.access_token;
    user = await currentUser(supabaseUrl, publishableKey, accessToken);
  }
  if (!user?.id)
    return secureJson(
      { authenticated: false, code: "session_invalid" },
      401,
      clearedSessionCookies(),
    );

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id,full_name,phone_e164,active,account_status,must_change_password,temporary_password_expires_at",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.id || !profile.active || profile.account_status !== "active")
    return secureJson(
      { authenticated: false, code: "account_inactive" },
      403,
      clearedSessionCookies(),
    );

  let role = "customer";
  let mustChangePassword = Boolean(profile.must_change_password);
  let temporaryPasswordExpiresAt = profile.temporary_password_expires_at || null;
  if (surface === "operation") {
    const { data: staff } = await admin
      .from("staff_members")
      .select(
        "role,active,must_change_password,temporary_password_expires_at",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    if (!staff?.active)
      return secureJson(
        { authenticated: false, code: "staff_inactive" },
        403,
        clearedSessionCookies(),
      );
    role = staff.role;
    mustChangePassword = Boolean(staff.must_change_password);
    temporaryPasswordExpiresAt = staff.temporary_password_expires_at || null;
  }

  const responseCookies = rotated
    ? sessionCookies(rotated, surface as AuthSurface, true).values
    : [];
  return secureJson(
    {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email || null,
        fullName: profile.full_name || "",
        phone: profile.phone_e164 || null,
        surface,
        role,
      },
      mustChangePassword,
      temporaryPasswordExpiresAt,
      rotated: Boolean(rotated),
    },
    200,
    responseCookies,
  );
};

export const config = { path: "/api/auth-bff-session" };
