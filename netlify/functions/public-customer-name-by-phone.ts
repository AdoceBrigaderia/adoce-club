import {
  allowedOrigin,
  clientIp,
  consumeRateLimit,
  env,
  hmacHex,
  json,
  normalizeBrazilPhone,
  serviceClient,
} from "./_shared/whatsapp-auth";

// Carrinho do site pede WhatsApp antes do nome (decisão do proprietário em
// 02/11/2026); se esse WhatsApp já tem cadastro no Clube Adoce, devolve só o
// nome para preencher sozinho -- nenhum outro dado do cliente. Não é login:
// qualquer pessoa pode consultar um número que não é dela, por isso o
// limite de tentativas por telefone e por IP, e a resposta nunca distingue
// "não encontrado" de "erro" em detalhe.
export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);
  const raw = await request.text();
  if (raw.length > 256) return json({ error: "Requisição inválida." }, 413);
  let body: { phone?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }
  const phone = normalizeBrazilPhone(body.phone || "");
  if (!phone) return json({ full_name: null });

  const admin = serviceClient();
  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  if (!admin || !hmacSecret) return json({ full_name: null });

  try {
    const [phoneHash, ipHash] = await Promise.all([
      hmacHex(hmacSecret, `phone:${phone}`),
      hmacHex(hmacSecret, `ip:${clientIp(request)}`),
    ]);
    const [phoneLimit, ipLimit] = await Promise.all([
      consumeRateLimit(admin, "customer_name_lookup:phone", phoneHash, 600, 5),
      consumeRateLimit(admin, "customer_name_lookup:ip", ipHash, 600, 30),
    ]);
    if (!phoneLimit.allowed || !ipLimit.allowed) return json({ full_name: null });

    const { data, error } = await admin.rpc("server_public_lookup_customer_name_by_phone", {
      requested_phone: phone,
    });
    if (error) {
      console.error("customer name lookup rpc error", JSON.stringify(error));
      return json({ full_name: null });
    }
    return json({ full_name: (data as string | null) || null });
  } catch (error) {
    console.error("customer name lookup failed", error instanceof Error ? error.message : String(error));
    return json({ full_name: null });
  }
};

export const config = { path: "/api/pedidos/cliente-por-telefone", timeout: 10 };
