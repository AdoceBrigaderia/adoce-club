import { createClient } from "@supabase/supabase-js";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
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

const actions = new Set(["deactivate", "reactivate", "request_deletion", "delete_account", "mark_duplicate", "cancel_deletion"]);
const reasons = new Set([
  "duplicate_registration", "customer_request", "created_by_mistake",
  "security_review", "terms_violation", "legal_requirement", "other",
]);

const notificationCopy = (name: string, action: string, reason: string) => {
  const firstName = name.trim().split(/\s+/)[0] || "cliente";
  const reasonText: Record<string, string> = {
    duplicate_registration: "identificamos mais de um cadastro e estamos preservando seu histórico em uma única conta",
    customer_request: "recebemos sua solicitação relacionada à exclusão do cadastro",
    created_by_mistake: "o cadastro foi identificado como criado por engano ou para teste",
    security_review: "o acesso foi suspenso preventivamente para uma verificação de segurança",
    terms_violation: "o acesso foi suspenso após revisão das regras do Clube Adoce",
    legal_requirement: "o cadastro foi atualizado para atender uma obrigação aplicável",
    other: "o cadastro passou por uma atualização administrativa",
  };
  const statusText = action === "reactivate" || action === "cancel_deletion"
    ? "Seu acesso ao Clube Adoce está ativo novamente."
    : action === "delete_account"
      ? "Seu acesso e seus dados pessoais foram excluídos. Mantivemos somente registros operacionais anonimizados exigidos para histórico e segurança."
      : action === "request_deletion"
      ? "Seu cadastro entrou no processo seguro de exclusão e tratamento dos dados aplicáveis."
      : "Seu acesso ao Clube Adoce foi desativado.";
  return {
    subject: action === "reactivate" || action === "cancel_deletion"
      ? "Seu acesso ao Clube Adoce foi reativado"
      : "Atualização importante no seu cadastro do Clube Adoce",
    text: `Olá, ${firstName}.\n\n${statusText}\n\nMotivo informado: ${reasonText[reason] || reasonText.other}.\n\nSe precisar revisar esta decisão ou corrigir seus dados, responda a este e-mail ou fale com a Adoce pelos canais oficiais.\n\nAdoce Brigaderia`,
  };
};

async function sendNotification(email: string, name: string, action: string, reason: string) {
  const resendKey = env("RESEND_API_KEY");
  if (!resendKey) return { status: "pending", error: "RESEND_API_KEY não configurada" };
  const copy = notificationCopy(name, action, reason);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env("ACCOUNT_NOTIFICATION_FROM") || "Clube Adoce <acesso@auth.adocebrigaderia.com.br>",
      to: [email],
      subject: copy.subject,
      text: copy.text,
    }),
  });
  if (!response.ok) return { status: "failed", error: `Resend ${response.status}` };
  return { status: "sent", error: null };
}

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken) return json({ error: "Sessão obrigatória." }, 401);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey) return json({ error: "Ação administrativa não configurada." }, 503);

  const sessionClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await sessionClient.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);
  // A identidade vem do JWT validado acima. A autorização administrativa é
  // consultada com o cliente de serviço para não depender das políticas RLS do
  // schema private dentro desta Function.
  const adminClient = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: staff, error: staffError } = await adminClient.from("staff_members").select("role,active").eq("user_id", userData.user.id).maybeSingle();
  if (staffError) return json({ error: "Não foi possível confirmar a permissão para excluir este cadastro." }, 500);
  if (!staff?.active || !["owner", "manager"].includes(staff.role)) {
    return json({ error: "Somente proprietários e gerentes podem alterar cadastros." }, 403);
  }

  const body = (await request.json().catch(() => ({}))) as {
    profileId?: string; action?: string; reasonCode?: string; reasonNote?: string;
  };
  const profileId = body.profileId?.trim() || "";
  const action = body.action || "";
  const reasonCode = body.reasonCode || "";
  const reasonNote = body.reasonNote?.trim() || null;
  if (!/^[0-9a-f-]{36}$/i.test(profileId) || !actions.has(action) || !reasons.has(reasonCode)) {
    return json({ error: "Ação ou motivo inválido." }, 400);
  }
  if (reasonCode === "other" && (!reasonNote || reasonNote.length < 5)) {
    return json({ error: "Explique o motivo com pelo menos 5 caracteres." }, 400);
  }
  if (profileId === userData.user.id) return json({ error: "Você não pode alterar o próprio cadastro por esta tela." }, 409);

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id,full_name,email,phone_e164,birth_date,preferred_channel,postal_code,address_line,address_number,address_complement,neighborhood,city,state_code,flavor_preferences,whatsapp_verified_at,auth_upgraded_at,account_status,active,status_reason_code,status_reason_note,status_changed_at,status_changed_by,member_code")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError || !profile) return json({ error: "Cliente não encontrado." }, 404);

  const resultingStatus = action === "delete_account"
    ? "anonymized"
    : action === "request_deletion"
      ? "pending_deletion"
    : action === "reactivate" || action === "cancel_deletion"
      ? "active"
      : "deactivated";
  const active = resultingStatus === "active";
  const now = new Date().toISOString();
  const profileUpdate = {
    account_status: resultingStatus,
    active,
    status_reason_code: reasonCode,
    status_reason_note: reasonNote,
    status_changed_at: now,
    status_changed_by: userData.user.id,
    updated_at: now,
    ...(action === "delete_account" ? {
      full_name: `Cadastro excluído ${profile.member_code.slice(-4)}`,
      email: null,
      phone_e164: null,
      birth_date: null,
      preferred_channel: "none",
      postal_code: null,
      address_line: null,
      address_number: null,
      address_complement: null,
      neighborhood: null,
      city: null,
      state_code: null,
      flavor_preferences: [],
      whatsapp_verified_at: null,
      auth_upgraded_at: null,
    } : {}),
  };
  const { error: updateError } = await adminClient.from("profiles").update(profileUpdate).eq("id", profileId);
  if (updateError) return json({ error: updateError.message }, 500);

  const restorePreviousState = async () => {
    await adminClient.from("profiles").update({
      account_status: profile.account_status,
      active: profile.active,
      status_reason_code: profile.status_reason_code,
      status_reason_note: profile.status_reason_note,
      status_changed_at: profile.status_changed_at,
      status_changed_by: profile.status_changed_by,
      full_name: profile.full_name,
      email: profile.email,
      phone_e164: profile.phone_e164,
      birth_date: profile.birth_date,
      preferred_channel: profile.preferred_channel,
      postal_code: profile.postal_code,
      address_line: profile.address_line,
      address_number: profile.address_number,
      address_complement: profile.address_complement,
      neighborhood: profile.neighborhood,
      city: profile.city,
      state_code: profile.state_code,
      flavor_preferences: profile.flavor_preferences,
      whatsapp_verified_at: profile.whatsapp_verified_at,
      auth_upgraded_at: profile.auth_upgraded_at,
      updated_at: new Date().toISOString(),
    }).eq("id", profileId);
    await adminClient.auth.admin.updateUserById(profileId, {
      ban_duration: profile.active ? "none" : "876000h",
    });
  };

  const initialNotificationStatus = profile.email ? "pending" : "not_applicable";
  const { data: actionRecord, error: actionError } = await adminClient.from("customer_account_actions").insert({
    profile_id: profileId,
    actor_user_id: userData.user.id,
    action,
    reason_code: reasonCode,
    reason_note: reasonNote,
    previous_status: profile.account_status,
    resulting_status: resultingStatus,
    notification_email: profile.email,
    notification_status: initialNotificationStatus,
    notification_error: null,
  }).select("id").single();
  if (actionError || !actionRecord) {
    await restorePreviousState();
    return json({ error: "A alteração não foi concluída porque o registro de auditoria falhou." }, 500);
  }

  const { error: authError } = action === "delete_account"
    ? await adminClient.auth.admin.deleteUser(profileId, true)
    : await adminClient.auth.admin.updateUserById(profileId, { ban_duration: active ? "none" : "876000h" });
  if (authError) {
    await restorePreviousState();
    await adminClient.from("customer_account_actions").delete().eq("id", actionRecord.id);
    return json({ error: "A alteração não foi concluída e o cadastro foi restaurado ao estado anterior." }, 500);
  }

  const notification = profile.email
    ? await sendNotification(profile.email, profile.full_name, action, reasonCode)
    : { status: "not_applicable", error: null };
  const { error: notificationAuditError } = await adminClient
    .from("customer_account_actions")
    .update({
      notification_status: notification.status,
      notification_error: notification.error,
    })
    .eq("id", actionRecord.id);

  const cleanupErrors: string[] = [];
  if (action === "delete_account") {
    const cleanupResults = await Promise.all([
      adminClient
        .from("customer_account_actions")
        .update({ notification_email: null, reason_note: null })
        .eq("profile_id", profileId),
      adminClient
        .from("audit_events")
        .update({ payload: { anonymized: true } })
        .eq("entity_type", "profile")
        .eq("entity_id", profileId),
      adminClient
        .from("service_requests")
        .update({
          customer_name: "Cliente excluído",
          customer_phone: "550000000000",
          customer_email: null,
          service_location: "Dados removidos",
          customer_notes: "",
        })
        .eq("profile_id", profileId),
      adminClient
        .from("crm_notes")
        .update({ note: "Conteúdo removido após exclusão do cadastro." })
        .eq("profile_id", profileId),
      adminClient
        .from("crm_tasks")
        .update({ title: "Cadastro excluído", description: "" })
        .eq("profile_id", profileId),
    ]);
    cleanupResults.forEach((result) => {
      if (result.error) cleanupErrors.push(result.error.message);
    });
  }

  return json({
    applied: true,
    resultingStatus,
    notificationStatus: notification.status,
    auditWarning: notificationAuditError || cleanupErrors.length > 0
      ? "A ação principal foi concluída, mas uma etapa secundária de auditoria precisa ser conferida."
      : null,
  });
};

export const config = { path: "/api/customer-account-action" };
