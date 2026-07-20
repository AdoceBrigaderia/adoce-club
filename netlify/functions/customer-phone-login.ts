import { createClient } from "@supabase/supabase-js";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) || process.env[name];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

const allowedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return new Set([
    "https://www.adocebrigaderia.com.br",
    "https://clube.adocebrigaderia.com.br",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]).has(origin);
};

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  return national.length === 10 || national.length === 11 ? `+55${national}` : null;
};

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);

  const body = (await request.json().catch(() => ({}))) as { phone?: string; password?: string };
  const phone = normalizePhone(body.phone || "");
  const password = body.password || "";
  if (!phone || !password) return json({ error: "Informe celular e senha." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey)
    return json({ error: "Acesso temporariamente indisponível." }, 503);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin
    .from("profiles")
    .select("id,active,account_status,auth_upgraded_at")
    .eq("phone_e164", phone)
    .maybeSingle();

  if (!profile?.id || !profile.active || profile.account_status !== "active" || !profile.auth_upgraded_at)
    return json({ error: "Celular ou senha incorretos." }, 401);

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
  const email = userData.user?.email;
  if (userError || !email) return json({ error: "Celular ou senha incorretos." }, 401);

  const forwardedIp = request.headers.get("x-nf-client-connection-ip") || "";
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
      ...(forwardedIp ? { "X-Forwarded-For": forwardedIp } : {}),
    },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    if (response.status === 429) return json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, 429);
    return json({ error: "Celular ou senha incorretos." }, 401);
  }

  return json(payload);
};

export const config = { path: "/api/customer-phone-login" };
