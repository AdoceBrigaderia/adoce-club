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

const OTP_TIMEOUT_MS = 20000;

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

const provisionalNames = new Set([
  "",
  "cliente",
  "cliente adoce",
  "adoce",
  "teste",
  "test",
  "nome",
  "sem nome",
  "nao informado",
  "não informado",
]);

export const isValidSignupFullName = (name: string | null | undefined) => {
  const normalized = (name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
  const connectors = new Set(["da", "das", "de", "do", "dos", "e"]);
  const meaningfulParts = normalized
    .split(" ")
    .filter((part) => !connectors.has(part));
  const validPart = /^(?:\p{L}{2,}(?:['’-]\p{L}{2,})*|\p{L}['’-]\p{L}{2,})$/u;

  return (
    normalized.length >= 5 &&
    meaningfulParts.length >= 2 &&
    meaningfulParts.every((part) => validPart.test(part)) &&
    !provisionalNames.has(normalized)
  );
};

const timedOut = (error: unknown) =>
  error instanceof Error &&
  (error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    /aborted|timeout/i.test(error.message));

const postAuthOtp = async (
  supabaseUrl: string,
  publishableKey: string,
  body: Record<string, unknown>,
  forwardedIp: string,
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OTP_TIMEOUT_MS);
  try {
    return await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/otp`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
        ...(forwardedIp ? { "X-Forwarded-For": forwardedIp } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

export default async (request: Request) => {
  if (request.method !== "POST")
    return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request))
    return json({ error: "Origem não autorizada." }, 403);

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    fullName?: string;
    createUser?: boolean;
  };
  const email = (body.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email))
    return json({ error: "Informe um e-mail válido." }, 400);
  if (body.createUser && !isValidSignupFullName(body.fullName))
    return json(
      { error: "Informe seu nome e sobrenome para criar seu cadastro." },
      400,
    );

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const siteUrl = (env("SITE_URL") || "https://www.adocebrigaderia.com.br").replace(
    /\/$/,
    "",
  );
  if (!supabaseUrl || !publishableKey)
    return json({ error: "Envio de código temporariamente indisponível." }, 503);

  const otpBody = {
    email,
    create_user: Boolean(body.createUser),
    redirect_to: `${siteUrl}/#entrar`,
    data: body.fullName?.trim()
      ? { full_name: body.fullName.trim() }
      : undefined,
  };
  const forwardedIp = request.headers.get("x-nf-client-connection-ip") || "";

  const interpret = async (response: Response) => {
    const payload = (await response.json().catch(() => ({}))) as {
      error_code?: string;
      code?: string;
      msg?: string;
      message?: string;
    };
    if (response.ok) return json({ sent: true });
    const code = payload.error_code || payload.code || "";
    if (response.status === 429)
      return json(
        { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
        429,
      );
    if (code === "otp_disabled")
      return json(
        { error: "Não encontramos uma conta ativa com este e-mail." },
        404,
      );
    if (/not authorized/i.test(payload.msg || payload.message || ""))
      return json(
        { error: "O envio por e-mail ainda não está liberado para este endereço." },
        503,
      );
    return json({ error: "Não foi possível enviar o código agora." }, 502);
  };

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await postAuthOtp(
        supabaseUrl,
        publishableKey,
        otpBody,
        forwardedIp,
      );
      return await interpret(response);
    } catch (error) {
      lastError = error;
      console.error("request-email-code otp", attempt, error);
      if (attempt === 1) continue;
    }
  }

  return json(
    {
      error: timedOut(lastError)
        ? "O serviço de e-mail demorou a responder. Tente novamente."
        : "Não foi possível enviar o código agora. Tente de novo em alguns segundos ou entre com celular e senha.",
    },
    timedOut(lastError) ? 504 : 502,
  );
};

export const config = {
  path: "/api/request-email-code",
  timeout: 26,
};
