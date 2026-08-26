import { createClient } from "@supabase/supabase-js";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

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

const temporaryPassword = "123456@adoce";

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
  const secretKey =
    env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey)
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

  const body = (await request.json().catch(() => ({}))) as {
    targetUserId?: string;
    targetKind?: "staff" | "customer";
  };
  const targetUserId = body.targetUserId?.trim() || "";
  const targetKind = body.targetKind;
  if (!/^[0-9a-f-]{36}$/i.test(targetUserId))
    return json({ error: "Usuário inválido." }, 400);
  if (!targetKind || !["staff", "customer"].includes(targetKind))
    return json({ error: "Tipo de usuário inválido." }, 400);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: targetProfile } = await admin
    .from("profiles")
    .select("id,full_name,active,account_status")
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

  return json({
    reset: true,
    fullName: targetProfile.full_name,
    temporaryPassword,
    mustChangePassword: true,
  });
};

export const config = { path: "/api/admin-reset-user-password" };
