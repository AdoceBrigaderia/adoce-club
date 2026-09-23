import twilio from "twilio";

export type WhatsAppMessageAddress = {
  from: string;
  to: string;
};

export type WhatsAppTemplatePayload = {
  contentSid: string;
  contentVariables: Record<string, string>;
};

export type WhatsAppSendDecision =
  | { mode: "body"; body: string }
  | { mode: "template"; template: WhatsAppTemplatePayload }
  | { mode: "template_required"; reason: string };

export const whatsappAddress = (value: string) =>
  value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;

export const compactTemplateValue = (value: string, maxLength = 900) =>
  value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

export async function hasRecentInboundMessage(
  client: ReturnType<typeof twilio>,
  address: WhatsAppMessageAddress,
) {
  const recent = await client.messages.list({
    from: address.to,
    to: address.from,
    limit: 1,
  });
  const incoming = recent[0];
  return Boolean(incoming?.dateSent && Date.now() - incoming.dateSent.getTime() < 24 * 60 * 60 * 1000);
}

export async function supportMessageSendDecision(
  client: ReturnType<typeof twilio>,
  address: WhatsAppMessageAddress,
  body: string,
  contentSid: string,
): Promise<WhatsAppSendDecision> {
  const withinWindow = await hasRecentInboundMessage(client, address);
  if (withinWindow) return { mode: "body", body };
  if (!contentSid) return { mode: "template_required", reason: "support_template_required" };
  return {
    mode: "template",
    template: {
      contentSid,
      contentVariables: {
        "1": compactTemplateValue(body, 900),
      },
    },
  };
}

export function messageCreatePayload(decision: Exclude<WhatsAppSendDecision, { mode: "template_required" }>) {
  if (decision.mode === "body") return { body: decision.body };
  return {
    contentSid: decision.template.contentSid,
    contentVariables: JSON.stringify(decision.template.contentVariables),
  };
}
