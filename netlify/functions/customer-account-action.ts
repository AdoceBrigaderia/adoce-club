import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";
import { allowedOrigin, env, isUuid, json, serviceClient } from "./_shared/whatsapp-auth";

const actions = new Set(["deactivate", "reactivate", "request_deletion", "delete_account", "mark_duplicate", "cancel_deletion"]);
const reasons = new Set([
  "duplicate_registration", "customer_request", "created_by_mistake",
  "security_review", "terms_violation", "legal_requirement", "other",
]);

const reasonText: Record<string, string> = {
  duplicate_registration: "identificamos mais de um cadastro e estamos preservando seu histórico em uma única conta",
  customer_request: "recebemos sua solicitação relacionada à exclusão do cadastro",
  created_by_mistake: "o cadastro foi identificado como criado por engano ou para teste",
  security_review: "o acesso foi suspenso preventivamente para uma verificação de segurança",
  terms_violation: "o acesso foi suspenso após revisão das regras do Clube Adoce",
  legal_requirement: "o cadastro foi atualizado para atender uma obrigação aplicável",
  other: "o cadastro passou por uma atualização administrativa",
};

const statusText = (action: string) =>
  action === "reactivate" || action === "cancel_deletion"
    ? "Seu acesso ao Clube Adoce está ativo novamente."
    : action === "delete_account"
      ? "Seu acesso e seus dados pessoais foram excluídos. Mantivemos somente registros operacionais anonimizados exigidos para histórico e segurança."
      : action === "request_deletion"
        ? "Seu cadastro entrou no processo seguro de exclusão e tratamento dos dados aplicáveis."
        : "Seu acesso ao Clube Adoce foi desativado.";

const whatsappAddress = (value: string) => (value.startsWith("whatsapp:") ? value : `whatsapp:${value}`);

// Nenhuma comunicação com o cliente passa por e-mail — só pelo WhatsApp
// oficial da Adoce (Twilio). Mensagem business-initiated (o cliente não
// necessariamente falou com a gente nas últimas 24h) exige um template
// aprovado pelo Meta, por isso fica atrás de ACCOUNT_STATUS_ENABLED até a
// aprovação sair — mesmo padrão de _shared/access-link.ts.
async function sendNotification(phone: string, name: string, action: string, reason: string) {
  if (env("TWILIO_ACCOUNT_STATUS_ENABLED") !== "true") {
    return { status: "disabled", error: "account_status_notification_disabled_until_template_approval" };
  }
  const accountSid = env("TWILIO_ACCOUNT_SID") || "";
  const authToken = env("TWILIO_AUTH_TOKEN") || "";
  const from = env("TWILIO_WHATSAPP_FROM") || "";
  const contentSid = env("TWILIO_ACCOUNT_STATUS_CONTENT_SID") || "";
  if (!accountSid || !authToken || !from || !contentSid) {
    return { status: "not_configured", error: "account_status_notification_configuration_missing" };
  }
  const firstName = name.trim().split(/\s+/)[0] || "cliente";
  try {
    const sent = await twilio(accountSid, authToken).messages.create({
      from: whatsappAddress(from),
      to: whatsappAddress(phone),
      contentSid,
      contentVariables: JSON.stringify({
        "1": firstName.slice(0, 60),
        "2": statusText(action),
        "3": reasonText[reason] || reasonText.other,
      }),
    });
    return { status: "sent", error: null, messageSid: sent.sid };
  } catch (error) {
    const status = Number((error as { status?: number })?.status || 0);
    const code = String((error as { code?: string | number })?.code || "unknown").slice(0, 40);
    return { status: "failed", error: `twilio_${status || "error"}_${code}` };
  }
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
  const notificationPhone = result.notification_phone as string | null;
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

  const notification = notificationPhone
    ? await sendNotification(notificationPhone, fullName, action, reasonCode)
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
