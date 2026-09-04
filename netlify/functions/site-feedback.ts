import {
  allowedOrigin,
  clientIp,
  consumeRateLimit,
  env,
  hmacHex,
  json,
  serviceClient,
} from "./_shared/whatsapp-auth";

const clean = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
const categories = new Set(["problem", "complaint", "suggestion", "compliment"]);

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  const phone = clean(body.phone, 24);
  const category = clean(body.category, 20);
  const message = clean(body.message, 3000);
  const pageUrl = clean(body.page_url, 500);
  if (name.length < 2 || message.length < 10 || !categories.has(category))
    return json({ error: "Informe seu nome, o tipo e detalhes do que aconteceu." }, 400);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Informe um e-mail válido." }, 400);

  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  const admin = serviceClient();
  if (!hmacSecret || !admin) return json({ error: "Canal temporariamente indisponível." }, 503);

  // Escrita pública sem sessão: sem limite aqui, era um canal aberto pra
  // encher site_feedback de spam. 5 por 10 min por IP é generoso pra alguém
  // com um problema real e curto pra um roteiro automatizado.
  const ip = clientIp(request);
  const ipHash = await hmacHex(hmacSecret, `ip:${ip}`);
  const limit = await consumeRateLimit(admin, "site_feedback:ip", ipHash, 600, 5);
  if (!limit.allowed)
    return json(
      { error: "Muitas mensagens em pouco tempo. Aguarde alguns minutos e tente de novo." },
      429,
      { "Retry-After": String(Math.max(limit.retry_after_seconds || 60, 1)) },
    );

  let profileId: string | null = null;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (token) {
    const { data } = await admin.auth.getUser(token);
    profileId = data.user?.id || null;
  }
  const protocol = `ADO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const { error } = await admin.from("site_feedback").insert({
    protocol,
    profile_id: profileId,
    category,
    customer_name: name,
    customer_email: email || null,
    customer_phone: phone || null,
    page_url: pageUrl,
    message,
  });
  if (error) return json({ error: "Não foi possível registrar agora. Tente novamente." }, 500);
  return json({ protocol }, 201);
};

export const config = { path: "/api/site-feedback" };
