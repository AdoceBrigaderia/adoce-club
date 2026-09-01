import twilio from "twilio";
import {
  authorizeStaffRequest,
  env,
  json,
  serviceClient,
} from "./_shared/whatsapp-auth";
import { mainMenuMessage } from "./_shared/whatsapp-order-bot";

type SupportThread = {
  id: string;
  phone_last4: string;
  department: "festival" | "quote";
  status: "waiting" | "open" | "closed";
  source_message_sid: string;
  assigned_staff_user_id?: string | null;
  messages?: Array<{
    id: number;
    direction: "inbound" | "outbound" | "system";
    body: string;
    staff_user_id?: string | null;
    created_at: string;
    media_kind?: "audio" | "image" | "video" | "document" | null;
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
      .from("whatsapp-support-media")
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
  const customer = original.from || "";
  if (original.to !== expectedOfficial || !customer.startsWith("whatsapp:+")) {
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
      const [{ data, error }, { data: orderNotificationHealth }] = await Promise.all([
        admin.rpc("server_list_whatsapp_support_threads"),
        admin.rpc("server_get_order_staff_notification_health"),
      ]);
      if (error) return json({ error: "Não foi possível carregar os atendimentos." }, 503);
      return json({ threads: data || [], orderNotificationHealth: orderNotificationHealth || null });
    }
    if (!UUID.test(threadId)) return json({ error: "Atendimento inválido." }, 400);
    const { data, error } = await admin.rpc("server_get_whatsapp_support_thread", {
      requested_thread_id: threadId,
    });
    if (error) return json({ error: "Não foi possível carregar a conversa." }, 503);
    if (!data) return json({ error: "Conversa não encontrada." }, 404);
    return json({ thread: await publicThread(admin, data as SupportThread) });
  }

  const contentType = request.headers.get("content-type") || "";
  let payload: { action?: string; threadId?: string; body?: string } = {};
  let attachment: File | null = null;
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    payload = {
      action: String(form.get("action") || ""),
      threadId: String(form.get("threadId") || ""),
      body: String(form.get("body") || ""),
    };
    const file = form.get("file");
    attachment = file instanceof File ? file : null;
  } else {
    payload = (await request.json().catch(() => ({}))) as typeof payload;
  }
  const threadId = payload.threadId?.trim() || "";
  const action = payload.action?.trim() || "";
  if (!UUID.test(threadId) || !['reply', 'close'].includes(action)) {
    return json({ error: "Ação de atendimento inválida." }, 400);
  }
  const body = payload.body?.trim().slice(0, 4000) || "";
  if (action === "reply" && !body && !attachment) return json({ error: "Escreva uma resposta ou anexe uma mídia." }, 400);
  if (attachment && (attachment.size <= 0 || attachment.size > 16 * 1024 * 1024))
    return json({ error: "A mídia precisa ter até 16 MB." }, 413);
  const mediaKind = attachment
    ? attachment.type.startsWith("audio/") ? "audio"
      : attachment.type.startsWith("image/") ? "image"
        : attachment.type.startsWith("video/") ? "video" : "document"
    : null;
  if (attachment && mediaKind === "document" && attachment.type !== "application/pdf")
    return json({ error: "Envie documentos em PDF." }, 415);

  const { data: loaded, error: loadError } = await admin.rpc(
    "server_get_whatsapp_support_thread",
    { requested_thread_id: threadId },
  );
  const thread = (loaded || null) as SupportThread | null;
  if (loadError) return json({ error: "Não foi possível carregar a conversa." }, 503);
  if (!thread || thread.status === "closed") return json({ error: "Este atendimento já foi encerrado." }, 409);

  const accountSid = env("TWILIO_ACCOUNT_SID") || "";
  const authToken = env("TWILIO_AUTH_TOKEN") || "";
  if (!accountSid || !authToken) return json({ error: "Envio do WhatsApp não configurado." }, 503);
  const client = twilio(accountSid, authToken);

  try {
    const address = await twilioAddress(client, thread);
    const outgoingBody = action === "close"
      ? `Atendimento encerrado. Quando precisar, escolha uma nova opção.\n\n${mainMenuMessage()}`
      : body;
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

    if (action === "close") {
      const { data: phoneHash, error: closeError } = await admin.rpc(
        "server_close_whatsapp_support_thread",
        {
          requested_thread_id: threadId,
          requested_staff_user_id: authorization.actorUserId,
        },
      );
      if (closeError || !phoneHash) throw new Error(`close_thread:${closeError?.code || "empty"}`);
      const { error: clearError } = await admin.rpc("server_clear_whatsapp_order_conversation", {
        requested_phone_hmac: phoneHash,
      });
      if (clearError) throw new Error(`clear_conversation:${clearError.code}`);
    }
    return json({ ok: true, messageSid: sent.sid, closed: action === "close" });
  } catch (error) {
    console.error("whatsapp support action failed", error instanceof Error ? error.message.split(":")[0] : "unknown");
    return json({ error: "Não foi possível enviar a mensagem agora." }, 502);
  }
};

export const config = { path: "/api/whatsapp/support", timeout: 20 };
