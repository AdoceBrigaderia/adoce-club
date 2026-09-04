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

// E-mail que nunca corresponde a uma conta real. Usado quando o celular não
// existe, para que o pedido custe o mesmo tempo e devolva a mesma resposta de
// quando o celular existe mas a senha está errada — sem essa equalização, a
// diferença de latência denuncia quais celulares são da equipe.
const NO_SUCH_ACCOUNT_EMAIL = "sem-conta@login.adocebrigaderia.com.br";

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);

  const body = (await request.json().catch(() => ({}))) as { phone?: string; password?: string };
  const phone = normalizeBrazilPhone(body.phone || "");
  const password = body.password || "";
  if (!phone || !password) return json({ error: "Informe celular e senha." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  const admin = serviceClient();
  if (!supabaseUrl || !publishableKey || !hmacSecret || !admin)
    return json({ error: "Acesso temporariamente indisponível." }, 503);

  const ip = clientIp(request);
  const phoneHash = await hmacHex(hmacSecret, `phone:${phone}`);
  const ipHash = await hmacHex(hmacSecret, `ip:${ip}`);
  const [phoneLimit, ipLimit] = await Promise.all([
    consumeRateLimit(admin, "staff_login:phone", phoneHash, 900, 8),
    consumeRateLimit(admin, "staff_login:ip", ipHash, 900, 30),
  ]);
  const retryAfter = Math.max(phoneLimit.retry_after_seconds || 0, ipLimit.retry_after_seconds || 0);
  if (!phoneLimit.allowed || !ipLimit.allowed)
    return json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      429,
      { "Retry-After": String(Math.max(retryAfter, 1)) },
    );

  const { data: profile } = await admin
    .from("profiles")
    .select("id,active,account_status")
    .eq("phone_e164", phone)
    .maybeSingle();
  const eligible = Boolean(profile?.id && profile.active && profile.account_status === "active");

  let staffFlag = false;
  let email = NO_SUCH_ACCOUNT_EMAIL;
  if (eligible) {
    const { data: staff } = await admin
      .from("staff_members")
      .select("active,must_change_password")
      .eq("user_id", profile!.id)
      .maybeSingle();
    if (staff?.active) {
      staffFlag = Boolean(staff.must_change_password);
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile!.id);
      if (!userError && userData.user?.email) email = userData.user.email;
    }
  }

  // Não repassamos o IP do cliente ao GoTrue: ele usaria esse header para o
  // próprio limite por IP, e um cabeçalho vindo do cliente pode ser forjado
  // para escapar dele. Preferimos só o limite acima, que já é por IP real.
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || email === NO_SUCH_ACCOUNT_EMAIL) {
    if (response.status === 429)
      return json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, 429);
    return json({ error: "Celular ou senha incorretos." }, 401);
  }

  return json({ ...payload, must_change_password: staffFlag });
};

export const config = { path: "/api/staff-phone-login" };
