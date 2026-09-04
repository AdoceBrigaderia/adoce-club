import { createClient } from "@supabase/supabase-js";
import { deliverAccessLink, generateAccessLink } from "./_shared/access-link";
import { allowedOrigin, env, json, normalizeBrazilPhone } from "./_shared/whatsapp-auth";

const allowedRoles = new Set(["owner", "manager", "attendant"]);

// Antes eram os 6 últimos dígitos de um único uint32 (~1 milhão de espaço).
// Mesma ideia de _shared, mas só dígitos — o balcão lê em voz alta pro
// cliente decorar até trocar no primeiro acesso.
const generateTemporaryPassword = () => {
  const digits = crypto.getRandomValues(new Uint32Array(8));
  return Array.from(digits, (value) => String(value % 10)).join("");
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
  const phone = normalizeBrazilPhone(body.phone || "");
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
  const temporaryPassword = generateTemporaryPassword();

  const { data: createdData, error: createError } = await admin.auth.admin.createUser({
    email: fallbackEmail,
    email_confirm: true,
    phone,
    phone_confirm: true,
    password: temporaryPassword,
    user_metadata: { full_name: fullName, created_at_counter: true },
  });
  const createdUser = createdData?.user;
  if (createError || !createdUser) {
    // "already registered" quase sempre é o mesmo telefone/e-mail em conta
    // encerrada (soft-deleted) — a mensagem genérica anterior escondia isso
    // do atendente, que só via "não foi possível criar" sem saber o motivo.
    const message = /already registered|already exists/i.test(createError?.message || "")
      ? "Este telefone já teve um cadastro encerrado. Fale com a Adoce para reativar em vez de criar outro."
      : "Não foi possível criar o cadastro.";
    return json({ error: message }, 409);
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
  let loginUrl = `${siteUrl}/clube/entrar`;
  const firstName = fullName.split(/\s+/)[0] || "cliente";
  let accessMessage =
    `Olá, ${firstName}! Seu Clube Adoce já está pronto. Abra ${loginUrl} e entre com este WhatsApp e a senha temporária: ${temporaryPassword}\n\nNo primeiro acesso o site pede que você troque essa senha por uma só sua, com no mínimo 6 caracteres.`;
  let whatsappSent = false;
  let whatsappStatus = "not_configured";
  let whatsappError: string | undefined;
  try {
    const access = await generateAccessLink(admin, fallbackEmail);
    loginUrl = access.loginUrl;
    accessMessage =
      `Olá, ${firstName}! Seu acesso ao Clube Adoce está pronto. Toque neste link para criar sua senha e acompanhar seus carimbos: ${loginUrl}\n\nO link é pessoal e temporário.`;
    const delivery = await deliverAccessLink(fullName, phone, access);
    whatsappSent = delivery.status === "accepted";
    whatsappStatus = delivery.status;
    whatsappError = delivery.error;
  } catch (error) {
    whatsappStatus = "link_generation_failed";
    whatsappError = error instanceof Error ? error.message : "access_link_generation_failed";
  }
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
    whatsappSent,
    whatsappStatus,
    whatsappError,
  });
};

export const config = { path: "/api/staff-create-customer" };
