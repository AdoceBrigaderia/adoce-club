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

export default async (request: Request) => {
  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!accessToken) return json({ error: "Sessão obrigatória." }, 401);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey =
    env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json({ error: "Geração de código não configurada no servidor." }, 503);
  }

  const sessionClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } =
    await sessionClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return json({ error: "Sessão inválida ou expirada." }, 401);
  }

  const { data: staff, error: staffError } = await sessionClient
    .from("staff_members")
    .select("role,active")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (staffError || !staff?.active || !allowedRoles.has(staff.role)) {
    return json({ error: "Seu perfil não pode gerar códigos de acesso." }, 403);
  }

  const body = (await request.json().catch(() => ({}))) as {
    profileId?: string;
  };
  const profileId = body.profileId?.trim() || "";
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) {
    return json({ error: "Membro inválido." }, 400);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id,full_name,email,phone_e164")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError || !profile) {
    return json({ error: "Membro não encontrado." }, 404);
  }
  if (!profile.email) {
    return json({ error: "Este membro não possui e-mail cadastrado." }, 409);
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recentGeneration } = await adminClient
    .from("audit_events")
    .select("id")
    .eq("actor_user_id", userData.user.id)
    .eq("action", "staff_access_code_generated")
    .eq("entity_type", "profile")
    .eq("entity_id", profile.id)
    .gte("created_at", oneMinuteAgo)
    .limit(1)
    .maybeSingle();
  if (recentGeneration) {
    return json(
      { error: "Aguarde um minuto antes de gerar outro código para este membro." },
      429,
    );
  }

  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
      options: {
        redirectTo: `${(env("SITE_URL") || "https://www.adocebrigaderia.com.br").replace(/\/$/, "")}/#minha-conta`,
      },
    });
  const accessCode = linkData?.properties?.email_otp;
  if (linkError || !accessCode) {
    return json({ error: "Não foi possível gerar o código de acesso." }, 502);
  }
  const siteUrl = (env("SITE_URL") || "https://www.adocebrigaderia.com.br").replace(/\/$/, "");
  const directParams = new URLSearchParams({ email: profile.email, code: accessCode });
  const loginUrl = `${siteUrl}/#acesso-direto?${directParams.toString()}`;

  const { error: auditError } = await adminClient.from("audit_events").insert({
    actor_user_id: userData.user.id,
    action: "staff_access_code_generated",
    entity_type: "profile",
    entity_id: profile.id,
    payload: {
      phone_suffix: profile.phone_e164?.replace(/\D/g, "").slice(-4) || null,
      delivery_options: profile.phone_e164 ? ["copy", "whatsapp"] : ["copy"],
      direct_login_link: true,
    },
  });
  if (auditError) {
    return json(
      { error: "O código foi bloqueado porque a auditoria não pôde ser registrada." },
      500,
    );
  }

  return json({
    code: accessCode,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone_e164,
    loginUrl,
  });
};

export const config = { path: "/api/staff-access-code" };
