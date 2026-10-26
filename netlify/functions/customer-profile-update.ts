import { createClient } from "@supabase/supabase-js";
import { normalizeBrazilPhone } from "./_shared/whatsapp-auth";
import { isAllowedAppOrigin } from "./_shared/production-origin";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;
const env = (name: string) => (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) || process.env[name];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const invalidNames = new Set(["cliente", "cliente adoce", "adoce", "teste", "test", "nome", "sem nome", "nao informado", "não informado"]);

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!isAllowedAppOrigin(request.headers.get("origin"))) return json({ error: "Origem não autorizada." }, 403);
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
  const body = await request.json().catch(() => ({})) as { profileId?: string; fullName?: string; phoneE164?: string; email?: string; birthDate?: string; preferredChannel?: string; postalCode?: string; addressLine?: string; addressNumber?: string; addressComplement?: string; neighborhood?: string; city?: string; stateCode?: string };
  const profileId = body.profileId?.trim() || "";
  const fullName = (body.fullName || "").trim().replace(/\s+/g, " ");
  const normalized = fullName.toLocaleLowerCase("pt-BR");
  const phoneE164 = body.phoneE164?.trim() ? normalizeBrazilPhone(body.phoneE164) : null;
  const email = body.email?.trim().toLocaleLowerCase() || null;
  if (
    !/^[0-9a-f-]{36}$/i.test(profileId)
    || fullName.length < 3
    || fullName.length > 120
    || !/[a-záàâãéêíóôõúç]/i.test(fullName)
    || invalidNames.has(normalized)
  ) return json({ code: "CUSTOMER_INVALID_NAME", error: "Informe o nome real do cliente." }, 400);
  if (body.phoneE164?.trim() && !phoneE164) return json({ code: "CUSTOMER_INVALID_PHONE", error: "Informe um celular com DDD válido." }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ code: "CUSTOMER_INVALID_EMAIL", error: "Informe um e-mail válido." }, 400);
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
  const { data: profile } = await admin.from("profiles").select("full_name,phone_e164,email,birth_date,preferred_channel,postal_code,address_line,address_number,address_complement,neighborhood,city,state_code,account_status").eq("id", profileId).maybeSingle();
  if (!profile || profile.account_status === "anonymized") return json({ error: "Cadastro não encontrado ou já excluído." }, 404);
  if (phoneE164) {
    const { data: duplicate } = await admin.from("profiles").select("id").eq("phone_e164", phoneE164).neq("id", profileId).eq("active", true).maybeSingle();
    if (duplicate) return json({ code: "CUSTOMER_PHONE_DUPLICATE", error: "Este celular já pertence a outro cliente. Abra o cadastro existente." }, 409);
  }
  const nextProfile = { full_name: fullName, phone_e164: phoneE164, email, birth_date: body.birthDate || null, preferred_channel: body.preferredChannel || null, postal_code: body.postalCode?.trim() || null, address_line: body.addressLine?.trim() || null, address_number: body.addressNumber?.trim() || null, address_complement: body.addressComplement?.trim() || null, neighborhood: body.neighborhood?.trim() || null, city: body.city?.trim() || null, state_code: body.stateCode?.trim().toUpperCase() || null, updated_at: new Date().toISOString() };
  const { error: updateError } = await admin.from("profiles").update(nextProfile).eq("id", profileId);
  if (updateError) return json({ code: updateError.code === "23505" ? "CUSTOMER_PHONE_DUPLICATE" : "CUSTOMER_PERSISTENCE_ERROR", error: updateError.code === "23505" ? "Este celular já pertence a outro cliente. Abra o cadastro existente." : "Não foi possível salvar o cadastro agora." }, updateError.code === "23505" ? 409 : 500);
  const { error: authError } = await admin.auth.admin.updateUserById(profileId, { user_metadata: { full_name: fullName } });
  if (authError) { await admin.from("profiles").update(profile).eq("id", profileId); return json({ code: "CUSTOMER_AUTH_SYNC_ERROR", error: "O cadastro não foi alterado porque a conta de acesso não pôde ser sincronizada." }, 500); }
  await admin.from("audit_events").insert({ actor_user_id: userData.user.id, action: "customer_profile_updated", entity_type: "profile", entity_id: profileId, payload: { changed_fields: Object.keys(nextProfile).filter((key) => key !== "updated_at" && String((profile as Record<string, unknown>)[key] || "") !== String((nextProfile as Record<string, unknown>)[key] || "")) } });
  return json({ updated: true, profile: { id: profileId, ...nextProfile } });
};

export const config = { path: "/api/customer-profile-update" };
