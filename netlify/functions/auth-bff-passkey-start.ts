import { createClient } from "@supabase/supabase-js";
import { guardBffCsrf, guardBffRequest } from "./_shared/request-security";
import {
  ACCESS_COOKIE,
  parseCookies,
  secureJson,
  type AuthSurface,
} from "./_shared/session-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

type PasskeyStartApi = {
  startAuthentication: () => Promise<{
    data: { challenge_id?: string; options?: unknown } | null;
    error: { message?: string; code?: string } | null;
  }>;
  startRegistration: () => Promise<{
    data: { challenge_id?: string; options?: unknown } | null;
    error: { message?: string; code?: string } | null;
  }>;
};

function passkeyApi(client: ReturnType<typeof createClient>) {
  return (client.auth as unknown as { passkey: PasskeyStartApi }).passkey;
}

export default async (request: Request) => {
  const requestRejection = guardBffRequest(request, {
    methods: ["POST"],
    configuredSiteUrl: env("SITE_URL"),
  });
  if (requestRejection) return requestRejection;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "authentication" | "registration";
    surface?: AuthSurface;
  };
  const action = body.action;
  const surface: AuthSurface = body.surface === "operation" ? "operation" : "client";
  if (!action || !["authentication", "registration"].includes(action))
    return secureJson({ error: "Cerimônia de chave de acesso inválida." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey)
    return secureJson({ error: "Chaves de acesso indisponíveis neste ambiente." }, 503);

  let accessToken = "";
  if (action === "registration") {
    const csrfRejection = guardBffCsrf(request);
    if (csrfRejection) return csrfRejection;

    accessToken = parseCookies(request).get(ACCESS_COOKIE) || "";
    if (!accessToken)
      return secureJson({ error: "Entre antes de cadastrar uma chave de acesso." }, 401);
  }

  const client = createClient(supabaseUrl, publishableKey, {
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      experimental: { passkey: true },
    },
  });

  const result = action === "registration"
    ? await passkeyApi(client).startRegistration()
    : await passkeyApi(client).startAuthentication();

  if (result.error || !result.data?.challenge_id || !result.data.options) {
    const disabled = result.error?.code === "passkey_disabled";
    return secureJson(
      {
        error: disabled
          ? "O login por biometria ainda não foi ativado neste ambiente."
          : result.error?.message || "Não foi possível iniciar a chave de acesso.",
        code: result.error?.code || "passkey_start_failed",
      },
      disabled ? 503 : 400,
    );
  }

  return secureJson({
    challengeId: result.data.challenge_id,
    options: result.data.options,
    action,
    surface,
  });
};

export const config = { path: "/api/auth-bff-passkey-start" };
