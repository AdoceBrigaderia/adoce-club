import { createClient } from "@supabase/supabase-js";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;
const env = (name: string) => (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) || process.env[name];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const invalidNames = new Set(["cliente", "cliente adoce", "adoce", "teste", "test", "nome", "sem nome", "nao informado", "não informado"]);

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const origin = request.headers.get("origin");
  if (origin && ![env("SITE_URL")?.replace(/\/$/, ""), "https://www.adocebrigaderia.com.br", "https://clube.adocebrigaderia.com.br", "http://localhost:5173"].filter(Boolean).includes(origin)) return json({ error: "Origem não autorizada." }, 403);
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !supabaseUrl || !publishableKey || !secretKey) return json({ error: "Ação administrativa não configurada." }, 503);
  const sessionClient = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: userData } = await sessionClient.auth.getUser(token);
  if (!userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);
  const { data: staff } = await sessionClient.from("staff_members").select("role,active").eq("user_id", userData.user.id).maybeSingle();
  if (!staff?.active || !["owner", "manager"].includes(staff.role)) return json({ error: "Acesso restrito a proprietários e gerentes." }, 403);
  const body = await request.json().catch(() => ({})) as { profileId?: string; fullName?: string };
  const profileId = body.profileId?.trim() || "";
  const fullName = (body.fullName || "").trim().replace(/\s+/g, " ");
  const normalized = fullName.toLocaleLowerCase("pt-BR");
  if (
    !/^[0-9a-f-]{36}$/i.test(profileId)
    || fullName.length < 3
    || fullName.length > 120
    || !/[a-záàâãéêíóôõúç]/i.test(fullName)
    || invalidNames.has(normalized)
  ) return json({ error: "Informe o nome real do cliente." }, 400);
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
  const { data: profile } = await admin.from("profiles").select("full_name,account_status").eq("id", profileId).maybeSingle();
  if (!profile || profile.account_status === "anonymized") return json({ error: "Cadastro não encontrado ou já excluído." }, 404);
  const { error: updateError } = await admin.from("profiles").update({ full_name: fullName, updated_at: new Date().toISOString() }).eq("id", profileId);
  if (updateError) return json({ error: updateError.message }, 500);
  const { error: authError } = await admin.auth.admin.updateUserById(profileId, { user_metadata: { full_name: fullName } });
  if (authError) { await admin.from("profiles").update({ full_name: profile.full_name }).eq("id", profileId); return json({ error: "O nome não foi alterado porque a conta de acesso não pôde ser atualizada." }, 500); }
  await admin.from("audit_events").insert({ actor_user_id: userData.user.id, action: "customer_name_updated", entity_type: "profile", entity_id: profileId, payload: { previous_name: profile.full_name, new_name: fullName } });
  return json({ updated: true });
};

export const config = { path: "/api/customer-profile-update" };
