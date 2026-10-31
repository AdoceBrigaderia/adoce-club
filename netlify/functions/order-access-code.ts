import {
  allowedOrigin,
  clientIp,
  consumeRateLimit,
  env,
  hmacHex,
  json,
  maskPhone,
  normalizeBrazilPhone,
  serviceClient,
} from "./_shared/whatsapp-auth";

// Codigo pelo WhatsApp para editar o pedido do dia em outro aparelho
// (InstantOrderPanel, tela "Voce ja fez um pedido hoje"). O codigo so e
// enviado ao proprio WhatsApp do pedido; confirmado, o banco devolve um
// acesso novo para cada pedido do dia daquele numero. A resposta do envio e
// sempre a mesma, exista pedido ou nao, para nao revelar quem pediu.
const asWhatsAppAddress = (value: string) =>
  value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;

async function sendCode(phone: string, code: string) {
  const accountSid = env("TWILIO_ACCOUNT_SID") || "";
  const authToken = env("TWILIO_AUTH_TOKEN") || "";
  const whatsappFrom = env("TWILIO_WHATSAPP_FROM") || "";
  const contentSid = env("TWILIO_CONTENT_SID") || "";
  if (!accountSid || !authToken || !whatsappFrom || !contentSid) return false;
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: asWhatsAppAddress(phone),
      From: asWhatsAppAddress(whatsappFrom),
      ContentSid: contentSid,
      ContentVariables: JSON.stringify({ "1": code }),
    }).toString(),
    signal: AbortSignal.timeout(15000),
  });
  const payload = (await response.json().catch(() => ({}))) as { sid?: string; status?: string };
  return response.ok && Boolean(payload.sid) && payload.status !== "failed";
}

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);
  const raw = await request.text();
  if (raw.length > 512) return json({ error: "Requisição inválida." }, 413);
  let body: { action?: string; phone?: string; code?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }
  const phone = normalizeBrazilPhone(body.phone || "");
  if (!phone) return json({ error: "Informe um WhatsApp com DDD." }, 400);

  const admin = serviceClient();
  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  if (!admin || !hmacSecret) return json({ error: "Serviço indisponível." }, 503);

  try {
    const phoneHash = await hmacHex(hmacSecret, `phone:${phone}`);
    const ipHash = await hmacHex(hmacSecret, `ip:${clientIp(request)}`);

    if (body.action === "send") {
      const [phoneLimit, ipLimit] = await Promise.all([
        consumeRateLimit(admin, "order_access_code:send:phone", phoneHash, 900, 3),
        consumeRateLimit(admin, "order_access_code:send:ip", ipHash, 900, 20),
      ]);
      if (!phoneLimit.allowed || !ipLimit.allowed) {
        return json({ error: "Muitos pedidos de código. Aguarde alguns minutos." }, 429);
      }
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
      const { data, error } = await admin.rpc("server_create_order_access_code", {
        requested_phone: phone,
        requested_code: code,
      });
      if (error) return json({ error: "Serviço indisponível." }, 503);
      if ((data as { ok?: boolean })?.ok && !(await sendCode(phone, code))) {
        return json({ error: "Não foi possível enviar o código agora. Fale com a loja pelo WhatsApp." }, 502);
      }
      return json({ sent: true, masked_phone: maskPhone(phone) });
    }

    if (body.action === "verify") {
      const code = String(body.code || "").replace(/\D/g, "");
      if (code.length !== 6) return json({ error: "Digite os 6 números do código." }, 400);
      const ipLimit = await consumeRateLimit(admin, "order_access_code:verify:ip", ipHash, 900, 30);
      if (!ipLimit.allowed) return json({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429);
      const { data, error } = await admin.rpc("server_verify_order_access_code", {
        requested_phone: phone,
        requested_code: code,
      });
      if (error) return json({ error: "Serviço indisponível." }, 503);
      const result = data as { ok: boolean; message?: string; orders?: { order_number: string; token: string }[] };
      if (!result.ok) return json({ error: result.message || "Código inválido." }, 400);
      return json({ orders: result.orders || [] });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch {
    return json({ error: "O serviço demorou a responder. Tente novamente." }, 503);
  }
};

export const config = { path: "/api/pedidos/codigo", timeout: 20 };
