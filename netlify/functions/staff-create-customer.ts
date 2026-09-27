import { createClient } from "@supabase/supabase-js";
import { deliverAccessLink, generateAccessLink } from "./_shared/access-link";
import { CounterCustomerError, findOrCreateCounterCustomer } from "./_shared/counter-customer";
import { allowedOrigin, env, json, normalizeBrazilPhone } from "./_shared/whatsapp-auth";

const allowedRoles = new Set(["owner", "manager", "attendant"]);

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

  let customer;
  try {
    customer = await findOrCreateCounterCustomer(admin, userData.user.id, fullName, phone);
  } catch (error) {
    if (error instanceof CounterCustomerError) return json({ error: error.message }, error.status);
    throw error;
  }
  if (customer.existing) {
    return json({
      profileId: customer.profileId,
      accountId: customer.accountId,
      fullName: customer.fullName,
      phone: customer.phone,
      existing: true,
    });
  }
  const { profileId, fallbackEmail } = customer;
  const temporaryPassword = customer.temporaryPassword || "";
  const membership = { account_id: customer.accountId };

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
  // Sem link wa.me/<cliente>: abrir esse deep link manda a mensagem pelo
  // WhatsApp PESSOAL de quem está no balcão, não pelo número oficial. Quando
  // o envio automático (Twilio) falha, o caminho seguro é ditar a senha
  // temporária para o cliente entrar sozinho -- accessMessage segue no
  // retorno só para "Copiar mensagem" e colar no canal oficial.
  return json({
    profileId,
    accountId: membership?.account_id || null,
    fullName,
    phone,
    existing: false,
    temporaryPassword,
    loginUrl,
    accessMessage,
    whatsappSent,
    whatsappStatus,
    whatsappError,
  });
};

export const config = { path: "/api/staff-create-customer" };
