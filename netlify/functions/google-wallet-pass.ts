import { guardBffRequest } from "./_shared/request-security";
import {
  ACCESS_COOKIE,
  SURFACE_COOKIE,
  parseCookies,
  secureJson,
} from "./_shared/session-security";
import {
  createGoogleWalletSaveUrl,
  readGoogleWalletConfig,
} from "./_shared/google-wallet";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

type PreparedPass = {
  profile_id: string;
  full_name: string;
  member_code: string;
  current_progress: number;
  available_rewards: number;
  object_suffix: string;
  generation_count: number;
  prepared_at: string;
};

async function preparePass(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
) {
  return fetch(
    `${supabaseUrl}/rest/v1/rpc/customer_prepare_google_wallet_pass`,
    {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
    },
  );
}

export default async (request: Request) => {
  const requestRejection = guardBffRequest(request, {
    methods: ["POST"],
    configuredSiteUrl: env("SITE_URL"),
    requireCsrf: true,
  });
  if (requestRejection) return requestRejection;

  const siteUrl = env("SITE_URL") || new URL(request.url).origin;
  const cookies = parseCookies(request);
  if (cookies.get(SURFACE_COOKIE) !== "client")
    return secureJson({ error: "Sessão do Clube obrigatória." }, 403);

  const accessToken = cookies.get(ACCESS_COOKIE) || "";
  if (!accessToken)
    return secureJson(
      { error: "Sessão expirada.", code: "session_refresh_required" },
      401,
    );

  const wallet = readGoogleWalletConfig((name) =>
    name === "SITE_URL" ? siteUrl : env(name),
  );
  if (!wallet.configured)
    return secureJson(
      {
        error: "A Carteira do Google ainda não foi ativada neste ambiente.",
        code: "google_wallet_not_configured",
        missing: wallet.missing,
      },
      503,
    );

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey)
    return secureJson(
      { error: "Carteira temporariamente indisponível." },
      503,
    );

  const upstream = await preparePass(
    supabaseUrl,
    publishableKey,
    accessToken,
  );
  if (upstream.status === 401)
    return secureJson(
      { error: "Sessão expirada.", code: "session_refresh_required" },
      401,
    );

  const raw = await upstream.text();
  let prepared: PreparedPass | null = null;
  try {
    prepared = raw ? (JSON.parse(raw) as PreparedPass) : null;
  } catch {
    prepared = null;
  }

  if (!upstream.ok || !prepared?.profile_id || !prepared?.object_suffix) {
    const source = prepared as unknown as {
      message?: string;
      error?: string;
    } | null;
    return secureJson(
      {
        error:
          source?.message ||
          source?.error ||
          "Não foi possível preparar seu cartão para a Carteira do Google.",
      },
      upstream.ok ? 500 : upstream.status,
    );
  }

  try {
    const origin = new URL(siteUrl).origin;
    const signed = createGoogleWalletSaveUrl(wallet.config, {
      profileId: prepared.profile_id,
      fullName: prepared.full_name,
      memberCode: prepared.member_code,
      currentProgress: Number(prepared.current_progress || 0),
      availableRewards: Number(prepared.available_rewards || 0),
      objectSuffix: prepared.object_suffix,
      accountUri: new URL("/#minha-conta", origin).toString(),
    });

    return secureJson(
      {
        configured: true,
        save_url: signed.saveUrl,
        object_id: signed.objectId,
        member_code: prepared.member_code,
        generation_count: prepared.generation_count,
        prepared_at: prepared.prepared_at,
      },
      200,
    );
  } catch (error) {
    console.error("google_wallet_pass_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return secureJson(
      {
        error: "Não foi possível assinar o cartão para a Carteira do Google.",
        code: "google_wallet_signing_failed",
      },
      503,
    );
  }
};

export const config = { path: "/api/google-wallet-pass" };
