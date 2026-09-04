import { createClient } from "@supabase/supabase-js";
import { allowedOrigin, env, isUuid, json, serviceClient } from "./_shared/whatsapp-auth";

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
  const admin = serviceClient();
  if (!supabaseUrl || !publishableKey || !admin) return json({ error: "Ação administrativa não configurada." }, 503);

  // A sessão do próprio gerente é quem chama a RPC — ela mesma confere o
  // papel (owner/manager) via private.is_staff() e o role check internos,
  // então não precisamos repetir a checagem aqui com a chave de serviço.
  const sessionClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await sessionClient.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  const body = (await request.json().catch(() => ({}))) as {
    profileId?: string; action?: string; reasonCode?: string; reasonNote?: string;
  };
  const profileId = body.profileId?.trim() || "";
  const action = body.action || "";
  const reasonCode = body.reasonCode || "";
  const reasonNote = body.reasonNote?.trim() || null;
  if (!isUuid(profileId) || !actions.has(action) || !reasons.has(reasonCode)) {
    return json({ error: "Ação ou motivo inválido." }, 400);
  }
  if (reasonCode === "other" && (!reasonNote || reasonNote.length < 5)) {
    return json({ error: "Explique o motivo com pelo menos 5 caracteres." }, 400);
  }
  if (profileId === userData.user.id) return json({ error: "Você não pode alterar o próprio cadastro por esta tela." }, 409);

  // server_customer_account_action faz, numa única transação: valida o
  // papel de quem chama, atualiza o profile (com a anonimização de
  // delete_account), grava customer_account_actions e, se for exclusão, já
  // anonimiza os registros relacionados (audit_events, service_requests,
  // crm_notes, crm_tasks). Antes eram ~11 gravações soltas sem transação,
  // com reversão escrita à mão que não cobria a limpeza de delete_account.
  const { data: result, error: rpcError } = await sessionClient.rpc("server_customer_account_action", {
    target_profile_id: profileId,
    requested_action: action,
    requested_reason_code: reasonCode,
    requested_reason_note: reasonNote,
  });
  if (rpcError) {
    const message = /Somente proprietários e gerentes/i.test(rpcError.message)
      ? "Somente proprietários e gerentes podem alterar cadastros."
      : /Cliente não encontrado/i.test(rpcError.message)
        ? "Cliente não encontrado."
        : "Não foi possível concluir a alteração agora.";
    return json({ error: message }, /permitidos|autorizado/i.test(rpcError.message) ? 403 : 409);
  }

  const actionId = result.action_id as string;
  const resultingStatus = result.resulting_status as string;
  const willBeActive = Boolean(result.will_be_active);
  const notificationEmail = result.notification_email as string | null;
  const fullName = result.full_name as string;

  // O ban/exclusão em auth.users passa pela API administrativa do GoTrue,
  // que fica fora da transação da RPC (ela só cobre o schema public). Se
  // falhar aqui, desfazemos a RPC inteira numa única chamada em vez de
  // reversão manual espalhada.
  const { error: authError } = action === "delete_account"
    ? await admin.auth.admin.deleteUser(profileId, true)
    : await admin.auth.admin.updateUserById(profileId, { ban_duration: willBeActive ? "none" : "876000h" });
  if (authError) {
    await sessionClient.rpc("server_revert_customer_account_action", { action_id: actionId });
    return json({ error: "A alteração não foi concluída e o cadastro foi restaurado ao estado anterior." }, 500);
  }

  const notification = notificationEmail
    ? await sendNotification(notificationEmail, fullName, action, reasonCode)
    : { status: "not_applicable", error: null };
  const { error: notificationAuditError } = await admin
    .from("customer_account_actions")
    .update({ notification_status: notification.status, notification_error: notification.error })
    .eq("id", actionId);

  return json({
    applied: true,
    resultingStatus,
    notificationStatus: notification.status,
    auditWarning: notificationAuditError
      ? "A ação principal foi concluída, mas uma etapa secundária de auditoria precisa ser conferida."
      : null,
  });
};

export const config = { path: "/api/customer-account-action" };
