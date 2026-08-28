declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const allowedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const configured = env("SITE_URL")?.replace(/\/$/, "");
  return new Set(
    [
      configured,
      "https://www.adocebrigaderia.com.br",
      "https://adocebrigaderia.com.br",
      "https://clube.adocebrigaderia.com.br",
      "https://operacao.adocebrigaderia.com.br",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4182",
      "http://127.0.0.1:4182",
    ].filter(Boolean),
  ).has(origin);
};

export default async (request: Request) => {
  if (request.method !== "POST")
    return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request))
    return json({ error: "Origem não autorizada." }, 403);

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    token?: string;
  };
  const email = (body.email || "").trim().toLowerCase();
  const token = (body.token || "").replace(/\D/g, "");
  if (!/^\S+@\S+\.\S+$/.test(email) || token.length !== 6)
    return json({ error: "Informe o e-mail e o código de 6 números." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey)
    return json({ error: "Validação temporariamente indisponível." }, 503);

  try {
    const forwardedIp = request.headers.get("x-nf-client-connection-ip") || "";
    const types = ["email", "recovery", "magiclink"] as const;
    let lastStatus = 401;
    for (const type of types) {
      const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify`, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          "Content-Type": "application/json",
          ...(forwardedIp ? { "X-Forwarded-For": forwardedIp } : {}),
        },
        body: JSON.stringify({ email, token, type }),
        signal: AbortSignal.timeout(20000),
      });
      const payload = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (response.ok) return json(payload);
      lastStatus = response.status;
      if (response.status === 429)
        return json(
          { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
          429,
        );
    }
    return json({ error: "Código inválido ou expirado." }, lastStatus === 429 ? 429 : 401);
  } catch {
    return json(
      { error: "O serviço de acesso demorou a responder. Tente novamente." },
      504,
    );
  }
};

export const config = { path: "/api/verify-email-code", timeout: 26 };
