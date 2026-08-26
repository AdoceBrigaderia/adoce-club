import { createClient } from "@supabase/supabase-js";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

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

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  return national.length === 10 || national.length === 11 ? `+55${national}` : null;
};

const isPlaceholderEmail = (email: string) =>
  /@membro\.adocebrigaderia\.com\.br$/i.test(email);

const maskEmail = (email: string) => {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  return `${user.slice(0, 1)}***@${domain}`;
};

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    phone?: string;
  };
  const emailInput = (body.email || "").trim().toLowerCase();
  const phone = body.phone ? normalizePhone(body.phone) : null;
  if (!emailInput && !phone) {
    return json({ error: "Informe o WhatsApp ou o e-mail da conta." }, 400);
  }

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  const siteUrl = (env("SITE_URL") || "https://www.adocebrigaderia.com.br").replace(/\/$/, "");
  if (!supabaseUrl || !secretKey) {
    return json({ error: "Recuperação temporariamente indisponível." }, 503);
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let email = emailInput;
  if (!email && phone) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email,phone_e164,active,account_status")
      .eq("phone_e164", phone)
      .maybeSingle();
    if (!profile?.active || profile.account_status !== "active") {
      return json({ error: "Não encontramos uma conta ativa com este WhatsApp." }, 404);
    }
    email = (profile.email || "").trim().toLowerCase();
  }

  if (!email || isPlaceholderEmail(email)) {
    return json(
      {
        error:
          "Este cadastro não tem um e-mail para recuperar a senha. Na loja a Adoce redefine em um instante.",
      },
      409,
    );
  }

  const { error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${siteUrl}/#entrar` },
  });
  if (error) {
    console.error("request-password-reset", error);
    const missing = /not found|unable to find|no user/i.test(error.message);
    return json(
      {
        error: missing
          ? "Não encontramos uma conta ativa com esses dados."
          : "Não foi possível enviar o e-mail agora. Tente de novo em alguns segundos.",
      },
      missing ? 404 : 502,
    );
  }

  return json({
    sent: true,
    email,
    hint: maskEmail(email),
  });
};

export const config = { path: "/api/request-password-reset", timeout: 26 };
