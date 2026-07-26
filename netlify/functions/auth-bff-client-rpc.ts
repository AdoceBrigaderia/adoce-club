import {
  ACCESS_COOKIE,
  SURFACE_COOKIE,
  allowedOrigin,
  parseCookies,
  secureJson,
  validCsrf,
} from "./_shared/session-security";
import {
  isAllowedClientRpc,
  type ClientBffRpcName,
} from "./_shared/bff-rpc-policy";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

type RpcRequestBody = { rpc?: unknown; params?: unknown };

function normalizedParams(value: unknown) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function forwardRpc(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
  rpc: ClientBffRpcName,
  params: Record<string, unknown>,
) {
  return fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params),
  });
}

export default async (request: Request) => {
  if (request.method !== "POST")
    return secureJson({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request, env("SITE_URL")))
    return secureJson({ error: "Origem não autorizada." }, 403);
  if (!validCsrf(request))
    return secureJson({ error: "Validação CSRF inválida." }, 403);

  const cookies = parseCookies(request);
  if (cookies.get(SURFACE_COOKIE) !== "client")
    return secureJson({ error: "Sessão do Clube obrigatória." }, 403);

  const accessToken = cookies.get(ACCESS_COOKIE) || "";
  if (!accessToken)
    return secureJson(
      { error: "Sessão expirada.", code: "session_refresh_required" },
      401,
    );

  const body = (await request.json().catch(() => ({}))) as RpcRequestBody;
  if (!isAllowedClientRpc(body.rpc))
    return secureJson({ error: "Operação não autorizada pelo BFF." }, 403);
  const params = normalizedParams(body.params);
  if (!params) return secureJson({ error: "Parâmetros inválidos." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey)
    return secureJson({ error: "Operação temporariamente indisponível." }, 503);

  const upstream = await forwardRpc(
    supabaseUrl,
    publishableKey,
    accessToken,
    body.rpc,
    params,
  );
  if (upstream.status === 401)
    return secureJson(
      { error: "Sessão expirada.", code: "session_refresh_required" },
      401,
    );

  const raw = await upstream.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { error: "Resposta inválida do serviço de dados." };
    }
  }

  if (!upstream.ok) {
    const source = payload as { message?: string; error?: string } | null;
    return secureJson(
      {
        error:
          source?.message ||
          source?.error ||
          "Não foi possível concluir o check-in.",
      },
      upstream.status >= 400 && upstream.status < 600 ? upstream.status : 500,
    );
  }

  return secureJson({ data: payload }, 200);
};

export const config = { path: "/api/auth-bff-client-rpc" };
