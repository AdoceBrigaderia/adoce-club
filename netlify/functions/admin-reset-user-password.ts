import { createClient } from "@supabase/supabase-js";
import { deliverAccessLink, generateAccessLink } from "./_shared/access-link";
import { consumeRateLimit, env, hmacHex, isUuid, json, serviceClient } from "./_shared/whatsapp-auth";

// Senha temporária única por reset — antes era sempre "123456@adoce" para
// qualquer conta, o que deixava uma janela adivinhável entre o reset e a
// pessoa trocar a senha. ~57 bits de entropia, sem caracteres ambíguos
// (0/O, 1/l/I), fácil de repassar por voz ou WhatsApp.
const PASSWORD_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const generateTemporaryPassword = () => {
  const random = crypto.getRandomValues(new Uint32Array(10));
  const body = Array.from(random, (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join("");
  return `${body}@1`;
};

export default async (request: Request) => {
  if (request.method !== "POST")
    return json({ error: "Método não permitido." }, 405);

  const accessToken = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!accessToken) return json({ error: "Sessão obrigatória." }, 401);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") ||
    env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  const admin = serviceClient();
  if (!supabaseUrl || !publishableKey || !hmacSecret || !admin)
    return json(
      { error: "Redefinição de senha indisponível no servidor." },
      503,
    );

  const sessionClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } =
    await sessionClient.auth.getUser(accessToken);
  if (userError || !userData.user)
    return json({ error: "Sessão inválida ou expirada." }, 401);

  const { data: actor } = await sessionClient
    .from("staff_members")
    .select("role,active")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!actor?.active || !["owner", "manager"].includes(actor.role))
    return json(
      { error: "Seu perfil não pode redefinir senhas." },
      403,
    );

  // Um gerente comprometido não pode martelar resets em massa: 10 por hora
  // é bem acima do uso normal (um reset por atendimento).
  const actorHash = await hmacHex(hmacSecret, `actor:${userData.user.id}`);
  const actorLimit = await consumeRateLimit(admin, "admin_password_reset:actor", actorHash, 3600, 10);
  if (!actorLimit.allowed)
    return json(
      { error: "Muitos resets em pouco tempo. Aguarde antes de continuar." },
      429,
      { "Retry-After": String(Math.max(actorLimit.retry_after_seconds || 60, 1)) },
    );

  const body = (await request.json().catch(() => ({}))) as {
    targetUserId?: string;
    targetKind?: "staff" | "customer";
  };
  const targetUserId = body.targetUserId?.trim() || "";
  const targetKind = body.targetKind;
  if (!isUuid(targetUserId))
    return json({ error: "Usuário inválido." }, 400);
  if (!targetKind || !["staff", "customer"].includes(targetKind))
    return json({ error: "Tipo de usuário inválido." }, 400);

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("id,full_name,email,phone_e164,active,account_status")
    .eq("id", targetUserId)
    .maybeSingle();
  if (
    !targetProfile?.id ||
    !targetProfile.active ||
    targetProfile.account_status !== "active"
  )
    return json({ error: "Usuário ativo não encontrado." }, 404);

  const { data: targetStaff } = await admin
    .from("staff_members")
    .select("user_id,active")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (targetKind === "staff" && !targetStaff?.active)
    return json({ error: "Colaborador ativo não encontrado." }, 404);
  if (targetKind === "customer" && targetStaff?.user_id)
    return json(
      { error: "Este cadastro pertence à equipe. Use a opção de colaborador." },
      409,
    );

  const temporaryPassword = generateTemporaryPassword();
  const now = new Date().toISOString();
  let flagError: { message?: string } | null = null;
  if (targetKind === "staff") {
    const { error } = await admin
      .from("staff_members")
      .update({ must_change_password: true })
      .eq("user_id", targetUserId);
    flagError = error;
  } else {
    const { error } = await admin
      .from("profiles")
      .update({
        must_change_password: true,
        auth_upgraded_at: now,
        updated_at: now,
      })
      .eq("id", targetUserId);
    flagError = error;
  }
  if (flagError)
    return json(
      { error: "Não foi possível exigir a troca da senha temporária." },
      500,
    );

  const { error: passwordError } = await admin.auth.admin.updateUserById(
    targetUserId,
    { password: temporaryPassword },
  );
  if (passwordError) {
    if (targetKind === "staff") {
      await admin
        .from("staff_members")
        .update({ must_change_password: false })
        .eq("user_id", targetUserId);
    } else {
      await admin
        .from("profiles")
        .update({ must_change_password: false, updated_at: now })
        .eq("id", targetUserId);
    }
    return json({ error: "Não foi possível redefinir a senha." }, 502);
  }

  await admin.from("audit_events").insert({
    actor_user_id: userData.user.id,
    action: "security.password_reset_by_manager",
    entity_type: targetKind,
    entity_id: targetUserId,
    payload: {
      target_kind: targetKind,
      force_change: true,
      temporary_password_disclosed_to_actor: true,
    },
  });

  let loginUrl: string | undefined;
  let whatsappSent = false;
  let whatsappStatus = "not_configured";
  let whatsappError: string | undefined;
  if (targetProfile.email) {
    try {
      const access = await generateAccessLink(admin, targetProfile.email);
      loginUrl = access.loginUrl;
      if (targetProfile.phone_e164) {
        const delivery = await deliverAccessLink(
          targetProfile.full_name,
          targetProfile.phone_e164,
          access,
        );
        whatsappSent = delivery.status === "accepted";
        whatsappStatus = delivery.status;
        whatsappError = delivery.error;
      } else {
        whatsappStatus = "phone_missing";
      }
    } catch (error) {
      whatsappStatus = "link_generation_failed";
      whatsappError = error instanceof Error ? error.message : "access_link_generation_failed";
    }
  } else {
    whatsappStatus = "email_missing";
  }

  return json({
    reset: true,
    fullName: targetProfile.full_name,
    temporaryPassword,
    mustChangePassword: true,
    loginUrl,
    whatsappSent,
    whatsappStatus,
    whatsappError,
  });
};

export const config = { path: "/api/admin-reset-user-password" };
