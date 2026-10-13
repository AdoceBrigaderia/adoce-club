import twilio from "twilio";
import { messageCreatePayload, supportMessageSendDecision } from "./_shared/whatsapp-approved-templates";
import { env, json, serviceClient } from "./_shared/whatsapp-auth";

type ScheduledSupportMessage = {
  id: string;
  thread_id: string;
  staff_user_id: string;
  body: string;
  source_message_sid: string;
};

const officialAddress = () => {
  const configured = env("TWILIO_WHATSAPP_FROM") || "";
  return configured.startsWith("whatsapp:") ? configured : `whatsapp:${configured}`;
};

const customerAddress = async (
  client: ReturnType<typeof twilio>,
  sourceMessageSid: string,
) => {
  const official = officialAddress();
  const original = await client.messages(sourceMessageSid).fetch();
  const customer = original.to === official
    ? original.from || ""
    : original.from === official
      ? original.to || ""
      : "";
  if (!customer.startsWith("whatsapp:+")) throw new Error("invalid_twilio_binding");
  return { official, customer };
};

export default async () => {
  const admin = serviceClient();
  if (!admin) return json({ ok: false, error: "Atendimento não configurado." }, 503);

  const accountSid = env("TWILIO_ACCOUNT_SID") || "";
  const authToken = env("TWILIO_AUTH_TOKEN") || "";
  if (!accountSid || !authToken || !officialAddress().startsWith("whatsapp:+")) {
    return json({ ok: false, error: "Envio do WhatsApp não configurado." }, 503);
  }

  const { data, error } = await admin.rpc("server_claim_due_whatsapp_support_messages", {
    batch_size: 10,
  });
  if (error) return json({ ok: false, error: "Não foi possível carregar mensagens programadas." }, 503);

  const messages = (Array.isArray(data) ? data : []) as ScheduledSupportMessage[];
  if (!messages.length) return json({ ok: true, sent: 0, failed: 0 });

  const client = twilio(accountSid, authToken, { autoRetry: false, timeout: 8000 });
  let sentCount = 0;
  let failedCount = 0;

  for (const message of messages) {
    try {
      const address = await customerAddress(client, message.source_message_sid);
      const decision = await supportMessageSendDecision(
        client,
        { from: address.official, to: address.customer },
        message.body,
        env("TWILIO_SUPPORT_MESSAGE_CONTENT_SID") || "",
      );
      if (decision.mode === "template_required") throw new Error(decision.reason);
      const sent = await client.messages.create({
        from: address.official,
        to: address.customer,
        ...messageCreatePayload(decision),
      });
      const completion = await admin.rpc("server_complete_whatsapp_scheduled_message", {
        requested_message_id: message.id,
        requested_message_sid: sent.sid,
        requested_success: true,
        requested_error: null,
      });
      if (completion.error) throw new Error(`store:${completion.error.code}`);
      sentCount += 1;
    } catch (error) {
      failedCount += 1;
      const summary = error instanceof Error ? error.message.split(":")[0] : "unknown";
      await admin.rpc("server_complete_whatsapp_scheduled_message", {
        requested_message_id: message.id,
        requested_message_sid: null,
        requested_success: false,
        requested_error: summary,
      });
    }
  }

  return json({ ok: true, sent: sentCount, failed: failedCount });
};

export const config = {
  schedule: "*/5 * * * *",
};

