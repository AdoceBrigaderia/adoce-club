import twilio from "twilio";
import { compactTemplateValue, hasRecentInboundMessage, messageCreatePayload, whatsappAddress } from "./_shared/whatsapp-approved-templates";
import {
  authorizeStaffRequest,
  env,
  hmacHex,
  json,
  serviceClient,
} from "./_shared/whatsapp-auth";

const firstName = (value: string) => value.trim().split(/\s+/)[0] || "cliente";

const stampText = (count: number) => count === 1 ? "1 carimbo" : `${count} carimbos`;

const buildMessage = (name: string, added: number, progress: number, rewards: number) => {
  if (rewards > 0) {
    const rewardText = rewards === 1 ? "uma fatia Adoce grátis" : `${rewards} fatias Adoce grátis`;
    return `Olá, ${firstName(name)}! Que alegria: seu Cartão Clube Adoce acabou de receber ${stampText(added)} e você completou seu cartão. Sua recompensa já está liberada: ${rewardText} para deixar o dia mais doce.`;
  }
  const remaining = Math.max(1, 14 - progress);
  return `Olá, ${firstName(name)}! Seu Cartão Clube Adoce acabou de receber ${stampText(added)}. Agora você está com ${progress} de 14 carimbos. Faltam só ${stampText(remaining)} para conquistar sua fatia Adoce grátis.`;
};

const buildTemplate = (name: string, added: number, progress: number, rewards: number) => {
  const customer = firstName(name).slice(0, 60);
  if (rewards > 0) {
    const rewardText = rewards === 1 ? "uma fatia Adoce grátis" : `${rewards} fatias Adoce grátis`;
    return {
      contentSid: env("TWILIO_LOYALTY_REWARD_CONTENT_SID") || "",
      contentVariables: {
        "1": customer,
        "2": stampText(added),
        "3": compactTemplateValue(rewardText, 120),
      },
      missingReason: "loyalty_reward_template_required",
    };
  }
  return {
    contentSid: env("TWILIO_LOYALTY_STAMPS_CONTENT_SID") || "",
    contentVariables: {
      "1": customer,
      "2": stampText(added),
      "3": String(progress),
      "4": stampText(Math.max(1, 14 - progress)),
    },
    missingReason: "loyalty_stamps_template_required",
  };
};

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const admin = serviceClient();
  if (!admin) return json({ error: "Aviso de carimbos não configurado." }, 503);

  const authorization = await authorizeStaffRequest(request, admin);
  if (authorization.errorResponse) return authorization.errorResponse;
  if (!authorization.actorUserId) return json({ error: "Operador inválido." }, 403);

  const payload = (await request.json().catch(() => ({}))) as {
    profileId?: string;
    stampsAdded?: number;
    progress?: number;
    newRewards?: number;
  };
  const profileId = String(payload.profileId || "");
  const stampsAdded = Number(payload.stampsAdded || 0);
  const progress = Number(payload.progress || 0);
  const newRewards = Number(payload.newRewards || 0);
  if (!profileId || !Number.isInteger(stampsAdded) || stampsAdded < 1 || stampsAdded > 50 || !Number.isInteger(progress)) {
    return json({ error: "Atualização de carimbos inválida." }, 400);
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("full_name,phone_e164")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError || !profile?.phone_e164) return json({ error: "Cliente sem WhatsApp cadastrado." }, 409);

  const accountSid = env("TWILIO_ACCOUNT_SID") || "";
  const authToken = env("TWILIO_AUTH_TOKEN") || "";
  const official = env("TWILIO_WHATSAPP_FROM") || "";
  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  if (!accountSid || !authToken || !official || !hmacSecret) return json({ error: "Envio do WhatsApp não configurado." }, 503);

  const from = whatsappAddress(official);
  const to = whatsappAddress(profile.phone_e164);
  const body = buildMessage(profile.full_name || "cliente", stampsAdded, progress, newRewards);

  try {
    const client = twilio(accountSid, authToken, { autoRetry: false, timeout: 8000 });
    const withinWindow = await hasRecentInboundMessage(client, { from, to });
    const template = buildTemplate(profile.full_name || "cliente", stampsAdded, progress, newRewards);
    if (!withinWindow && !template.contentSid) {
      return json({ error: "Carimbos lançados, mas a mensagem exige modelo aprovado da Twilio." }, 409);
    }
    const sent = await client.messages.create({
      from,
      to,
      ...messageCreatePayload(withinWindow ? { mode: "body", body } : { mode: "template", template }),
    });
    const phoneHash = await hmacHex(hmacSecret, `phone:${profile.phone_e164}`);
    const recorded = await admin.rpc("server_start_whatsapp_support_conversation", {
      requested_phone_hmac: phoneHash,
      requested_phone_last4: profile.phone_e164.slice(-4),
      requested_message_sid: sent.sid,
      requested_body: body,
      requested_staff_user_id: authorization.actorUserId,
    });
    if (recorded.error) throw new Error(`store:${recorded.error.code}`);
    return json({ ok: true, status: "accepted" });
  } catch (error) {
    console.error("loyalty stamp message failed", error instanceof Error ? error.message.split(":")[0] : "unknown");
    return json({ error: "Carimbos lançados, mas não foi possível avisar pelo WhatsApp oficial." }, 502);
  }
};

export const config = { path: "/api/loyalty/stamp-message", timeout: 20 };


