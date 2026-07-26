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

type AdminPasskeyApi = {
  deletePasskey: (input: { userId: string; passkeyId: string }) => Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

export default async (request: Request) => {
  if (request.method !== "POST")
    return secureJson({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request, env("SITE_URL")))
    return secureJson({ error: "Origem não autorizada." }, 403);
  if (!validCsrf(request))
    return secureJson({ error: "Validação CSRF inválida." }, 403);

  const accessToken = parseCookies(request).get(ACCESS_COOKIE) || "";
  if (!accessToken)
    return secureJson({ error: "Sessão obrigatória." }, 401);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey)
    return secureJson({ error: "Administração de chaves indisponível." }, 503);

  const sessionClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await sessionClient.auth.getUser(accessToken);
  if (userError || !userData.user)
    return secureJson({ error: "Sessão inválida ou expirada." }, 401);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      experimental: { passkey: true },
    },
  });
  const { data: actor } = await admin
    .from("staff_members")
    .select("role,active")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!actor?.active || !["owner", "manager"].includes(actor.role))
    return secureJson({ error: "Seu perfil não pode revogar chaves da equipe." }, 403);

  const body = (await request.json().catch(() => ({}))) as {
    targetUserId?: string;
    passkeyId?: string;
  };
  const targetUserId = body.targetUserId?.trim() || "";
  const passkeyId = body.passkeyId?.trim() || "";
  if (!/^[0-9a-f-]{36}$/i.test(targetUserId) || !passkeyId)
    return secureJson({ error: "Usuário ou chave de acesso inválidos." }, 400);

  const passkeyAdmin = (admin.auth as unknown as {
    admin: { passkey: AdminPasskeyApi };
  }).admin.passkey;
  const result = await passkeyAdmin.deletePasskey({ userId: targetUserId, passkeyId });
  if (result.error)
    return secureJson({ error: result.error.message || "Não foi possível revogar a chave." }, 400);

  await admin.from("audit_events").insert({
    actor_user_id: userData.user.id,
    action: "security.passkey_revoked_by_manager",
    entity_type: "staff",
    entity_id: targetUserId,
    payload: { passkey_id: passkeyId },
  });

  return secureJson({ revoked: true, targetUserId, passkeyId });
};

export const config = { path: "/api/admin-revoke-user-passkey" };
