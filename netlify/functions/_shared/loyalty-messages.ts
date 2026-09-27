import twilio from "twilio";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverAccessLink, type AccessLink } from "./access-link";
import { compactTemplateValue, hasRecentInboundMessage, messageCreatePayload, whatsappAddress, type WhatsAppTemplatePayload } from "./whatsapp-approved-templates";
import { env, hmacHex } from "./whatsapp-auth";

// Mensagens do Clube Adoce pelo WhatsApp oficial: carimbos recebidos e
// boas-vindas de quem foi cadastrado no fechamento da venda.

export type MessageResult = { ok: true } | { ok: false; error: string };

const firstName = (value: string) => value.trim().split(/\s+/)[0] || "cliente";
export const stampText = (count: number) => count === 1 ? "1 carimbo" : `${count} carimbos`;

const buildStampMessage = (name: string, added: number, progress: number, rewards: number) => {
  if (rewards > 0) {
    const rewardText = rewards === 1 ? "uma fatia Adoce grátis" : `${rewards} fatias Adoce grátis`;
    return `Olá, ${firstName(name)}! Que alegria: seu Cartão Clube Adoce acabou de receber ${stampText(added)} e você completou seu cartão. Sua recompensa já está liberada: ${rewardText} para deixar o dia mais doce.`;
  }
  const remaining = Math.max(1, 14 - progress);
  return `Olá, ${firstName(name)}! Seu Cartão Clube Adoce acabou de receber ${stampText(added)}. Agora você está com ${progress} de 14 carimbos. Faltam só ${stampText(remaining)} para conquistar sua fatia Adoce grátis.`;
};

const buildStampTemplate = (name: string, added: number, progress: number, rewards: number): WhatsAppTemplatePayload => {
  const customer = firstName(name).slice(0, 60);
  if (rewards > 0) {
    const rewardText = rewards === 1 ? "uma fatia Adoce grátis" : `${rewards} fatias Adoce grátis`;
    return {
      contentSid: env("TWILIO_LOYALTY_REWARD_CONTENT_SID") || "",
      contentVariables: { "1": customer, "2": stampText(added), "3": compactTemplateValue(rewardText, 120) },
    };
  }
  return {
    contentSid: env("TWILIO_LOYALTY_STAMPS_CONTENT_SID") || "",
    contentVariables: { "1": customer, "2": stampText(added), "3": String(progress), "4": stampText(Math.max(1, 14 - progress)) },
  };
};

// Texto usado quando o cliente falou com a loja nas últimas 24 h (a Meta permite
// texto livre) e como referência do modelo "adoce_boas_vindas_clube".
export const buildWelcomeMessage = (name: string, stamps: number, loginUrl: string) =>
  `Olá, ${firstName(name)}! Seja bem-vindo(a) ao Clube Adoce! 💛\n\n` +
  `Seu cadastro foi criado e você já participa do nosso programa de fidelidade. Funciona assim: cada fatia comprada vale 1 carimbo e, ao juntar 14 carimbos, você ganha uma fatia tradicional grátis.\n\n` +
  `Carimbos desta compra: ${stamps > 0 ? stampText(stamps) : "nenhum (fatia de fidelidade)"}.\n\n` +
  `Crie sua senha e acompanhe seus carimbos por este link: ${loginUrl}\n\nO link é pessoal e temporário.`;

function twilioSetup() {
  const accountSid = env("TWILIO_ACCOUNT_SID") || "";
  const authToken = env("TWILIO_AUTH_TOKEN") || "";
  const official = env("TWILIO_WHATSAPP_FROM") || "";
  if (!accountSid || !authToken || !official) return null;
  return { client: twilio(accountSid, authToken, { autoRetry: false, timeout: 8000 }), from: whatsappAddress(official) };
}

async function recordConversation(admin: SupabaseClient, phone: string, sid: string, body: string, actorUserId: string) {
  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  if (!hmacSecret) return;
  const phoneHash = await hmacHex(hmacSecret, `phone:${phone}`);
  const recorded = await admin.rpc("server_start_whatsapp_support_conversation", {
    requested_phone_hmac: phoneHash,
    requested_phone_last4: phone.slice(-4),
    requested_message_sid: sid,
    requested_body: body,
    requested_staff_user_id: actorUserId,
  });
  if (recorded.error) throw new Error(`store:${recorded.error.code}`);
}

export async function sendStampMessage(admin: SupabaseClient, opts: {
  fullName: string; phone: string; stampsAdded: number; progress: number; newRewards: number; actorUserId: string;
}): Promise<MessageResult> {
  const setup = twilioSetup();
  if (!setup || !env("AUTH_RATE_LIMIT_HMAC_SECRET")) return { ok: false, error: "Envio do WhatsApp não configurado." };
  const to = whatsappAddress(opts.phone);
  const body = buildStampMessage(opts.fullName, opts.stampsAdded, opts.progress, opts.newRewards);
  try {
    const withinWindow = await hasRecentInboundMessage(setup.client, { from: setup.from, to });
    const template = buildStampTemplate(opts.fullName, opts.stampsAdded, opts.progress, opts.newRewards);
    if (!withinWindow && !template.contentSid) return { ok: false, error: "Carimbos lançados, mas a mensagem exige modelo aprovado da Twilio." };
    const sent = await setup.client.messages.create({
      from: setup.from, to,
      ...messageCreatePayload(withinWindow ? { mode: "body", body } : { mode: "template", template }),
    });
    await recordConversation(admin, opts.phone, sent.sid, body, opts.actorUserId);
    return { ok: true };
  } catch (error) {
    console.error("loyalty stamp message failed", error instanceof Error ? error.message.split(":")[0] : "unknown");
    return { ok: false, error: "Carimbos lançados, mas não foi possível avisar pelo WhatsApp oficial." };
  }
}

async function templateApproved(client: ReturnType<typeof twilio>, contentSid: string) {
  try {
    const approval = await client.content.v1.contents(contentSid).approvalFetch().fetch();
    const whatsapp = (approval.whatsapp || {}) as { status?: string };
    return String(whatsapp.status || "").toLowerCase() === "approved";
  } catch {
    return false;
  }
}

// Boas-vindas com explicação do programa e link para criar a senha.
// Ordem de preferência: modelo aprovado de boas-vindas → texto livre (janela de
// 24 h) → modelo antigo só com o link de acesso.
export async function sendClubWelcome(admin: SupabaseClient, opts: {
  fullName: string; phone: string; stamps: number; access: AccessLink; actorUserId: string;
}): Promise<MessageResult> {
  const setup = twilioSetup();
  if (!setup) return { ok: false, error: "Envio do WhatsApp não configurado." };
  const to = whatsappAddress(opts.phone);
  const body = buildWelcomeMessage(opts.fullName, opts.stamps, opts.access.loginUrl);
  const configuredWelcomeSid = env("TWILIO_CLUB_WELCOME_CONTENT_SID") || "";
  try {
    // A Twilio aceita o envio de modelo ainda não aprovado e só falha depois;
    // por isso o modelo de boas-vindas só é usado quando a Meta já aprovou.
    const welcomeSid = configuredWelcomeSid && await templateApproved(setup.client, configuredWelcomeSid) ? configuredWelcomeSid : "";
    let sid = "";
    if (welcomeSid) {
      const sent = await setup.client.messages.create({
        from: setup.from, to, contentSid: welcomeSid,
        // Modelo "adoce_boas_vindas_clube": {{1}} nome, {{2}} final do link do botão "Criar minha senha".
        contentVariables: JSON.stringify({
          "1": firstName(opts.fullName).slice(0, 60),
          "2": opts.access.querySuffix,
        }),
      });
      sid = sent.sid;
    } else if (await hasRecentInboundMessage(setup.client, { from: setup.from, to })) {
      const sent = await setup.client.messages.create({ from: setup.from, to, body });
      sid = sent.sid;
    } else {
      const delivery = await deliverAccessLink(opts.fullName, opts.phone, opts.access);
      if (delivery.status !== "accepted") return { ok: false, error: "Cadastro criado, mas o link de acesso não foi enviado pelo WhatsApp." };
      sid = delivery.messageSid || "";
    }
    // O link é um acesso pessoal: não fica salvo no histórico da conversa.
    const stored = buildWelcomeMessage(opts.fullName, opts.stamps, "[link pessoal de acesso]");
    if (sid) await recordConversation(admin, opts.phone, sid, stored, opts.actorUserId).catch(() => undefined);
    return { ok: true };
  } catch (error) {
    console.error("club welcome message failed", error instanceof Error ? error.message.split(":")[0] : "unknown");
    return { ok: false, error: "Cadastro criado, mas não foi possível enviar as boas-vindas pelo WhatsApp." };
  }
}
