import twilio from "twilio";
import { messageCreatePayload, supportMessageSendDecision } from "./_shared/whatsapp-approved-templates";
import {
  authorizeStaffRequest,
  env,
  hmacHex,
  json,
  normalizeBrazilPhone,
  serviceClient,
} from "./_shared/whatsapp-auth";
import { resolveThreadContacts } from "./_shared/whatsapp-contacts";

type SupportThread = {
  id: string;
  phone_last4: string;
  department: "festival" | "quote";
  status: "waiting" | "open" | "closed";
  automation_mode?: "bot" | "human";
  source_message_sid: string;
  assigned_staff_user_id?: string | null;
  messages?: Array<{
    id: number;
    direction: "inbound" | "outbound" | "system";
    body: string;
    staff_user_id?: string | null;
    created_at: string;
    media_kind?: "audio" | "image" | "video" | "document" | null;
    media_bucket?: string;
    media_storage_path?: string | null;
    media_content_type?: string | null;
    media_filename?: string | null;
    media_size_bytes?: number | null;
    media_duration_seconds?: number | null;
  }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const publicThread = async (admin: ReturnType<typeof serviceClient>, thread: SupportThread | null) => {
  if (!thread) return null;
  const { source_message_sid: _privateSource, ...safe } = thread;
  if (!admin || !safe.messages?.length) return safe;
  const messages = await Promise.all(safe.messages.map(async (message) => {
    if (!message.media_storage_path) return message;
    const { data } = await admin.storage
      .from(message.media_bucket === "order-payment-receipts" ? "order-payment-receipts" : "whatsapp-support-media")
      .createSignedUrl(message.media_storage_path, 3600);
    const { media_storage_path: _privatePath, ...publicMessage } = message;
    return { ...publicMessage, media_url: data?.signedUrl || null };
  }));
  return { ...safe, messages };
};

const twilioAddress = async (client: ReturnType<typeof twilio>, thread: SupportThread) => {
  const official = env("TWILIO_WHATSAPP_FROM") || "";
  const expectedOfficial = official.startsWith("whatsapp:") ? official : `whatsapp:${official}`;
  const original = await client.messages(thread.source_message_sid).fetch();
  const customer = original.to === expectedOfficial ? original.from || "" : original.from === expectedOfficial ? original.to || "" : "";
  if (!customer.startsWith("whatsapp:+")) {
    throw new Error("invalid_twilio_binding");
  }
  return { customer, official: expectedOfficial };
};

export default async (request: Request) => {
  if (!['GET', 'POST'].includes(request.method)) {
    return json({ error: "Método não permitido." }, 405);
  }

  const admin = serviceClient();
  if (!admin) return json({ error: "Atendimento não configurado no servidor." }, 503);
  const authorization = await authorizeStaffRequest(request, admin);
  if (authorization.errorResponse) return authorization.errorResponse;
  if (!authorization.actorUserId) return json({ error: "Operador inválido." }, 403);

  if (request.method === "GET") {
    const threadId = new URL(request.url).searchParams.get("thread") || "";
    if (!threadId) {
      const history = new URL(request.url).searchParams.get("view") === "history";
      const [{ data, error }, { data: orderNotificationHealth }] = await Promise.all([
        admin.rpc(history ? "server_list_whatsapp_support_history" : "server_list_whatsapp_support_threads"),
        admin.rpc("server_get_order_staff_notification_health"),
      ]);
      if (error) return json({ error: "Não foi possível carregar os atendimentos." }, 503);
      const threads = (Array.isArray(data) ? data : []) as Array<{ id: string }>;
      // Telefone completo e nome do cliente: falha aqui nunca derruba a lista.
      const contacts = await resolveThreadContacts(admin, threads.map((thread) => thread.id)).catch(() => new Map());
      return json({
        threads: threads.map((thread) => ({ ...thread, ...(contacts.get(thread.id) || { phone_e164: null, customer_name: null }) })),
        orderNotificationHealth: orderNotificationHealth || null,
      });
    }
    if (!UUID.test(threadId)) return json({ error: "Atendimento inválido." }, 400);
    const { data, error } = await admin.rpc("server_get_whatsapp_support_thread", {
      requested_thread_id: threadId,
    });
    if (error) return json({ error: "Não foi possível carregar a conversa." }, 503);
    if (!data) return json({ error: "Conversa não encontrada." }, 404);
    const contacts = await resolveThreadContacts(admin, [threadId], { twilioLimit: 1 }).catch(() => new Map());
    const detail = await publicThread(admin, data as SupportThread);
    return json({ thread: detail ? { ...detail, ...(contacts.get(threadId) || { phone_e164: null, customer_name: null }) } : null });
  }

  const contentType = request.headers.get("content-type") || "";
  let payload: { action?: string; threadId?: string; body?: string; scheduledAt?: string; scheduledMessageId?: string; phone?: string } = {};
  let attachment: File | null = null;
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    payload = {
      action: String(form.get("action") || ""),
      threadId: String(form.get("threadId") || ""),
      body: String(form.get("body") || ""),
      scheduledAt: String(form.get("scheduledAt") || ""),
      scheduledMessageId: String(form.get("scheduledMessageId") || ""),
      phone: String(form.get("phone") || ""),
    };
    const file = form.get("file");
    attachment = file instanceof File ? file : null;
  } else {
    payload = (await request.json().catch(() => ({}))) as typeof payload;
  }
  const threadId = payload.threadId?.trim() || "";
  const action = payload.action?.trim() || "";
  if ((!UUID.test(threadId) && action !== "start") || !['reply', 'close', 'takeover', 'resume', 'reopen', 'schedule', 'cancelScheduled', 'start'].includes(action)) {
    return json({ error: "Ação de atendimento inválida." }, 400);
  }
  const body = payload.body?.trim().slice(0, 4000) || "";
  if (action === "reply" && !body && !attachment) return json({ error: "Escreva uma resposta ou anexe uma mídia." }, 400);
  if (action === "start" && (!body || attachment)) return json({ error: "Informe o telefone e escreva a primeira mensagem." }, 400);
  if (action === "schedule" && (!body || attachment)) return json({ error: "Para agendar, escreva uma mensagem de texto sem anexo." }, 400);
  if (action === "cancelScheduled" && !UUID.test(payload.scheduledMessageId?.trim() || "")) return json({ error: "Mensagem programada inválida." }, 400);
  if (attachment && (attachment.size <= 0 || attachment.size > 16 * 1024 * 1024))
    return json({ error: "A mídia precisa ter até 16 MB." }, 413);
  const mediaKind = attachment
    ? attachment.type.startsWith("audio/") ? "audio"
      : attachment.type.startsWith("image/") ? "image"
        : attachment.type.startsWith("video/") ? "video" : "document"
    : null;
  if (attachment && mediaKind === "document" && attachment.type !== "application/pdf")
    return json({ error: "Envie documentos em PDF." }, 415);

  if (action === "start") {
    const phone = normalizeBrazilPhone(payload.phone || "");
    if (!phone) return json({ error: "Informe um WhatsApp válido com DDD." }, 400);
    const accountSid = env("TWILIO_ACCOUNT_SID") || "";
    const authToken = env("TWILIO_AUTH_TOKEN") || "";
    const official = env("TWILIO_WHATSAPP_FROM") || "";
    const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
    if (!accountSid || !authToken || !official || !hmacSecret) return json({ error: "Envio do WhatsApp não configurado." }, 503);
    const from = official.startsWith("whatsapp:") ? official : `whatsapp:${official}`;
    const client = twilio(accountSid, authToken, { autoRetry: false, timeout: 8000 });
    try {
      const to = `whatsapp:${phone}`;
      const decision = await supportMessageSendDecision(
        client,
        { from, to },
        body,
        env("TWILIO_SUPPORT_MESSAGE_CONTENT_SID") || "",
      );
      if (decision.mode === "template_required") {
        return json({ error: "Para iniciar conversa fora da janela de atendimento, configure o modelo aprovado da Twilio." }, 409);
      }
      const sent = await client.messages.create({
        from,
        to,
        ...messageCreatePayload(decision),
      });
      const phoneHash = await hmacHex(hmacSecret, `phone:${phone}`);
      const { data, error } = await admin.rpc("server_start_whatsapp_support_conversation", {
        requested_phone_hmac: phoneHash,
        requested_phone_last4: phone.slice(-4),
        requested_message_sid: sent.sid,
        requested_body: body,
        requested_staff_user_id: authorization.actorUserId,
      });
      if (error) throw new Error(`store_start:${error.code}`);
      return json({ ok: true, started: true, threadId: data?.id || null, messageSid: sent.sid });
    } catch (error) {
      console.error("whatsapp support start failed", error instanceof Error ? error.message.split(":")[0] : "unknown");
      return json({ error: "Não foi possível iniciar a conversa pelo WhatsApp oficial." }, 502);
    }
  }

  const { data: loaded, error: loadError } = await admin.rpc(
    "server_get_whatsapp_support_thread",
    { requested_thread_id: threadId },
  );
  const thread = (loaded || null) as SupportThread | null;
  if (loadError) return json({ error: "Não foi possível carregar a conversa." }, 503);
  if (!thread) return json({ error: "Conversa não encontrada." }, 404);

  if (action === "reopen") {
    const { error } = await admin.rpc("server_reopen_whatsapp_support_chat", {
      requested_thread_id: threadId,
      requested_staff_user_id: authorization.actorUserId,
    });
    if (error) return json({ error: "Não foi possível reabrir a conversa. Atualize e tente novamente." }, 409);
    return json({ ok: true, reopened: true });
  }

  if (action === "cancelScheduled") {
    const { error } = await admin.rpc("server_cancel_whatsapp_scheduled_message", {
      requested_message_id: payload.scheduledMessageId?.trim(),
      requested_staff_user_id: authorization.actorUserId,
    });
    if (error) return json({ error: "Não foi possível cancelar a mensagem programada." }, 409);
    return json({ ok: true, cancelled: true });
  }

  if (thread.status === "closed") return json({ error: "Este atendimento já foi encerrado." }, 409);

  if (action === "close") {
    const { error } = await admin.rpc("server_end_whatsapp_support_chat", {
      requested_thread_id: threadId, requested_staff_user_id: authorization.actorUserId,
    });
    if (error) return json({ error: "Não foi possível encerrar a conversa. Atualize e tente novamente." }, 409);
    return json({ ok: true, closed: true });
  }
  if(action === "takeover" || action === "resume") {
    const changed=await admin.rpc("server_set_whatsapp_conversation_mode",{
      requested_thread_id:threadId,requested_staff_user_id:authorization.actorUserId,requested_mode:action==="takeover"?"human":"bot",
    });
    if(changed.error) return json({error:changed.error.code==="55P03"?changed.error.message:"Não foi possível alterar o responsável pela conversa."},409);
    return json({ok:true});
  }
  if (action === "schedule") {
    const scheduledAt = payload.scheduledAt ? new Date(payload.scheduledAt) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return json({ error: "Informe uma data e horário válidos." }, 400);
    const { data, error } = await admin.rpc("server_schedule_whatsapp_support_message", {
      requested_thread_id: threadId,
      requested_staff_user_id: authorization.actorUserId,
      requested_body: body,
      requested_scheduled_at: scheduledAt.toISOString(),
    });
    if (error) return json({ error: error.message || "Não foi possível agendar a mensagem." }, 409);
    return json({ ok: true, scheduled: true, id: data?.id || null });
  }
  if(thread.automation_mode!=="human" || thread.assigned_staff_user_id!==authorization.actorUserId)
    return json({error:"Assuma a conversa antes de responder. O robô será pausado."},409);

  const accountSid = env("TWILIO_ACCOUNT_SID") || "";
  const authToken = env("TWILIO_AUTH_TOKEN") || "";
  if (!accountSid || !authToken) return json({ error: "Envio do WhatsApp não configurado." }, 503);
  const client = twilio(accountSid, authToken);

  try {
    const address = await twilioAddress(client, thread);
    const outgoingBody = body;
    let storagePath: string | null = null;
    let signedUrl: string | null = null;
    if (attachment && mediaKind) {
      storagePath = `outbound/${threadId}/${crypto.randomUUID()}-${attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120)}`;
      const upload = await admin.storage.from("whatsapp-support-media").upload(storagePath, attachment, {
        contentType: attachment.type || "application/octet-stream",
        upsert: false,
      });
      if (upload.error) throw new Error(`media_upload:${upload.error.message}`);
      const signed = await admin.storage.from("whatsapp-support-media").createSignedUrl(storagePath, 3600);
      if (signed.error || !signed.data?.signedUrl) throw new Error("media_signed_url");
      signedUrl = signed.data.signedUrl;
    }
    const sent = await client.messages.create({
      from: address.official,
      to: address.customer,
      ...(outgoingBody ? { body: outgoingBody } : {}),
      ...(signedUrl ? { mediaUrl: [signedUrl] } : {}),
    });
    const { error: replyError } = attachment && mediaKind && storagePath
      ? await admin.rpc("server_add_whatsapp_support_media", {
        requested_thread_id: threadId,
        requested_staff_user_id: authorization.actorUserId,
        requested_message_sid: sent.sid,
        requested_body: outgoingBody || `Mídia enviada: ${attachment.name}`,
        requested_media_kind: mediaKind,
        requested_media_storage_path: storagePath,
        requested_media_content_type: attachment.type || "application/octet-stream",
        requested_media_filename: attachment.name,
        requested_media_size_bytes: attachment.size,
        requested_media_duration_seconds: null,
      })
      : await admin.rpc("server_add_whatsapp_support_reply", {
        requested_thread_id: threadId,
        requested_staff_user_id: authorization.actorUserId,
        requested_message_sid: sent.sid,
        requested_body: outgoingBody,
      });
    if (replyError) throw new Error(`store_reply:${replyError.code}`);

    return json({ ok: true, messageSid: sent.sid, closed: false });
  } catch (error) {
    console.error("whatsapp support action failed", error instanceof Error ? error.message.split(":")[0] : "unknown");
    return json({ error: "Não foi possível enviar a mensagem agora." }, 502);
  }
};

export const config = { path: "/api/whatsapp/support", timeout: 20 };

