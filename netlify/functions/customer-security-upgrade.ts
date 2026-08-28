import { createClient } from "@supabase/supabase-js";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const allowedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const configured = env("SITE_URL")?.replace(/\/$/, "");
  return new Set([
    configured,
    "https://www.adocebrigaderia.com.br",
    "https://clube.adocebrigaderia.com.br",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ].filter(Boolean)).has(origin);
};

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  return national.length === 10 || national.length === 11
    ? `+55${national}`
    : null;
};

const validPassword = (password: string) => password.length >= 6;

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);

  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!accessToken) return json({ error: "Sessão obrigatória." }, 401);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json({ error: "Atualização de segurança não configurada no servidor." }, 503);
  }

  const sessionClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await sessionClient.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  const body = (await request.json().catch(() => ({}))) as {
    phone?: string;
    password?: string;
  };
  const phone = normalizePhone(body.phone || "");
  const password = body.password || "";
  if (!phone) return json({ error: "Informe um celular válido com DDD." }, 400);
  if (!validPassword(password)) {
    return json({ error: "A senha deve ter pelo menos 6 caracteres." }, 400);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id,phone_e164,whatsapp_verified_at,active,account_status,auth_upgraded_at")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || !profile) return json({ error: "Cadastro não encontrado." }, 404);
  if (!profile.active || profile.account_status !== "active") {
    return json({ error: "Este cadastro não está ativo. Fale com a Adoce." }, 403);
  }
  const { data: collision } = await adminClient
    .from("profiles")
    .select("id")
    .eq("phone_e164", phone)
    .neq("id", userData.user.id)
    .limit(1)
    .maybeSingle();
  if (collision) {
    return json({ error: "Este celular já está ligado a outro cadastro. A Adoce precisa unificar as contas." }, 409);
  }

  const now = new Date().toISOString();
  const { error: profilePhoneError } = await adminClient
    .from("profiles")
    .update({ phone_e164: phone, updated_at: now })
    .eq("id", userData.user.id);
  if (profilePhoneError) {
    return json({ error: "Não foi possível reservar este celular para o cadastro." }, 409);
  }

  const { error: authError } = await adminClient.auth.admin.updateUserById(userData.user.id, {
    phone,
    phone_confirm: true,
    password,
    app_metadata: {
      ...userData.user.app_metadata,
      customer_login_version: 2,
    },
  });
  if (authError) return json({ error: authError.message }, 409);

  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ auth_upgraded_at: now, updated_at: now })
    .eq("id", userData.user.id);
  if (updateError) return json({ error: "A senha foi criada, mas o cadastro precisa ser revisado pela Adoce." }, 500);

  const { error: auditError } = await adminClient.from("audit_events").insert({
    actor_user_id: userData.user.id,
    action: "customer.security_upgraded",
    entity_type: "profile",
    entity_id: userData.user.id,
    payload: { phone_suffix: phone.slice(-4), login_version: 2 },
  });
  if (auditError) return json({ error: "A atualização foi concluída, mas a auditoria precisa ser revisada." }, 500);

  return json({ upgraded: true, phone });
};

export const config = { path: "/api/customer-security-upgrade" };
