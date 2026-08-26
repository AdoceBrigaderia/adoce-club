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

const allowedRoles = new Set(["owner", "manager", "attendant"]);

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  return national.length === 10 || national.length === 11 ? `+55${national}` : null;
};

const allowedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const configured = env("SITE_URL")?.replace(/\/$/, "");
  return new Set(
    [
      configured,
      "https://www.adocebrigaderia.com.br",
      "https://clube.adocebrigaderia.com.br",
      "https://operacao.adocebrigaderia.com.br",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4182",
      "http://127.0.0.1:4182",
    ].filter(Boolean),
  ).has(origin);
};

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
    return json({ error: "Cadastro do balcão não configurado no servidor." }, 503);
  }

  const sessionClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await sessionClient.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  const { data: staff, error: staffError } = await sessionClient
    .from("staff_members")
    .select("role,active")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (staffError || !staff?.active || !allowedRoles.has(staff.role)) {
    return json({ error: "Seu perfil não pode cadastrar clientes." }, 403);
  }

  const body = (await request.json().catch(() => ({}))) as {
    fullName?: string;
    phone?: string;
  };
  const fullName = (body.fullName || "").trim().replace(/\s+/g, " ");
  const phone = normalizePhone(body.phone || "");
  if (fullName.split(" ").filter((part) => part.length > 1).length < 2) {
    return json({ error: "Informe nome e sobrenome." }, 400);
  }
  if (!phone) return json({ error: "Informe um WhatsApp com DDD." }, 400);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing } = await admin
    .from("profiles")
    .select("id,full_name,phone_e164")
    .eq("phone_e164", phone)
    .maybeSingle();
  if (existing?.id) {
    const { data: membership } = await admin
      .from("account_memberships")
      .select("account_id")
      .eq("profile_id", existing.id)
      .eq("active", true)
      .eq("is_primary", true)
      .maybeSingle();
    return json({
      profileId: existing.id,
      accountId: membership?.account_id || null,
      fullName: existing.full_name,
      phone: existing.phone_e164,
      existing: true,
    });
  }

  const fallbackEmail = `${phone.replace(/\D/g, "")}@membro.adocebrigaderia.com.br`;
  const temporaryPassword = Array.from(crypto.getRandomValues(new Uint32Array(1)))[0]
    .toString()
    .slice(-6)
    .padStart(6, "0");

  let createdUser = (
    await admin.auth.admin.createUser({
      email: fallbackEmail,
      email_confirm: true,
      phone,
      phone_confirm: true,
      password: temporaryPassword,
      user_metadata: { full_name: fullName, created_at_counter: true },
    })
  ).data.user;
  if (!createdUser) {
    return json({ error: "Não foi possível criar o cadastro." }, 409);
  }

  const profileId = createdUser.id;
  const now = new Date().toISOString();
  await admin
    .from("profiles")
    .update({
      full_name: fullName,
      phone_e164: phone,
      auth_upgraded_at: now,
      must_change_password: true,
      updated_at: now,
    })
    .eq("id", profileId);

  await admin.from("consent_events").insert([
    { profile_id: profileId, consent_type: "club_terms", granted: true, document_version: "1.0", source: "operation_counter" },
    { profile_id: profileId, consent_type: "privacy", granted: true, document_version: "1.0", source: "operation_counter" },
  ]);

  const { data: membership } = await admin
    .from("account_memberships")
    .select("account_id")
    .eq("profile_id", profileId)
    .eq("active", true)
    .eq("is_primary", true)
    .maybeSingle();

  await admin.from("audit_events").insert({
    actor_user_id: userData.user.id,
    action: "customer.created_at_counter",
    entity_type: "profile",
    entity_id: profileId,
    payload: { phone_suffix: phone.slice(-4), source: "operation_counter" },
  });

  const siteUrl = (env("SITE_URL") || "https://www.adocebrigaderia.com.br").replace(/\/$/, "");
  const loginUrl = `${siteUrl}/#entrar`;
  const firstName = fullName.split(/\s+/)[0] || "cliente";
  const accessMessage =
    `Olá, ${firstName}! Seu Clube Adoce já está pronto. Abra ${loginUrl} e entre com este WhatsApp e a senha temporária: ${temporaryPassword}\n\nNo primeiro acesso o site pede que você troque essa senha por uma só sua, com no mínimo 6 caracteres.`;
  const whatsappDigits = phone.replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(accessMessage)}`;

  return json({
    profileId,
    accountId: membership?.account_id || null,
    fullName,
    phone,
    existing: false,
    temporaryPassword,
    loginUrl,
    accessMessage,
    whatsappUrl,
  });
};

export const config = { path: "/api/staff-create-customer" };
