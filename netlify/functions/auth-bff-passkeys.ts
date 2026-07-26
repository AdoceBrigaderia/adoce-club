import { createClient } from "@supabase/supabase-js";
import {
  ACCESS_COOKIE,
  allowedOrigin,
  parseCookies,
  secureJson,
  validCsrf,
} from "./_shared/session-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

type PasskeyRow = {
  id: string;
  friendly_name?: string;
  created_at?: string;
  last_used_at?: string | null;
};

type PasskeyManagementApi = {
  list: () => Promise<{ data: PasskeyRow[] | null; error: { message?: string } | null }>;
  update: (input: { passkeyId: string; friendlyName: string }) => Promise<{
    data: PasskeyRow | null;
    error: { message?: string } | null;
  }>;
  delete: (input: { passkeyId: string }) => Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

function api(client: ReturnType<typeof createClient>) {
  return (client.auth as unknown as { passkey: PasskeyManagementApi }).passkey;
}

export default async (request: Request) => {
  if (!allowedOrigin(request, env("SITE_URL")))
    return secureJson({ error: "Origem não autorizada." }, 403);
  if (!['GET', 'POST'].includes(request.method))
    return secureJson({ error: "Método não permitido." }, 405);

  const accessToken = parseCookies(request).get(ACCESS_COOKIE) || "";
  if (!accessToken)
    return secureJson({ error: "Sessão obrigatória." }, 401);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey)
    return secureJson({ error: "Chaves de acesso indisponíveis neste ambiente." }, 503);

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      experimental: { passkey: true },
    },
  });

  if (request.method === "GET") {
    const result = await api(client).list();
    if (result.error)
      return secureJson({ error: result.error.message || "Não foi possível listar as chaves." }, 400);
    return secureJson({ passkeys: result.data || [] });
  }

  if (!validCsrf(request))
    return secureJson({ error: "Validação CSRF inválida." }, 403);
  const body = (await request.json().catch(() => ({}))) as {
    action?: "rename" | "delete";
    passkeyId?: string;
    friendlyName?: string;
  };
  const passkeyId = body.passkeyId?.trim() || "";
  if (!passkeyId)
    return secureJson({ error: "Chave de acesso inválida." }, 400);

  if (body.action === "rename") {
    const friendlyName = body.friendlyName?.trim().slice(0, 120) || "";
    if (friendlyName.length < 2)
      return secureJson({ error: "Informe um nome para identificar este aparelho." }, 400);
    const result = await api(client).update({ passkeyId, friendlyName });
    if (result.error)
      return secureJson({ error: result.error.message || "Não foi possível renomear a chave." }, 400);
    return secureJson({ updated: true, passkey: result.data });
  }

  if (body.action === "delete") {
    const result = await api(client).delete({ passkeyId });
    if (result.error)
      return secureJson({ error: result.error.message || "Não foi possível excluir a chave." }, 400);
    return secureJson({ deleted: true, passkeyId });
  }

  return secureJson({ error: "Ação inválida." }, 400);
};

export const config = { path: "/api/auth-bff-passkeys" };
