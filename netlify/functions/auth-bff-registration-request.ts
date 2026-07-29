import { createClient } from "@supabase/supabase-js";
import { guardBffRequest } from "./_shared/request-security";
import { secureJson } from "./_shared/session-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const normalizedEmail = (value: string) => value.trim().toLowerCase();
const normalizedName = (value: string) =>
  value.trim().replace(/\s+/g, " ").slice(0, 160);

export default async (request: Request) => {
  const requestRejection = guardBffRequest(request, {
    methods: ["POST"],
    configuredSiteUrl: env("SITE_URL"),
  });
  if (requestRejection) return requestRejection;

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    fullName?: string;
  };
  const email = normalizedEmail(body.email || "");
  const fullName = normalizedName(body.fullName || "");
  if (!/^\S+@\S+\.\S+$/.test(email) || fullName.length < 5)
    return secureJson({ error: "Revise nome e e-mail." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey)
    return secureJson({ error: "Cadastro temporariamente indisponível." }, 503);

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { full_name: fullName },
    },
  });

  if (error) {
    const status = error.status === 429 ? 429 : 400;
    return secureJson(
      {
        error:
          status === 429
            ? "Muitas solicitações. Aguarde alguns minutos."
            : "Não foi possível enviar o código agora.",
      },
      status,
    );
  }

  return secureJson({ accepted: true });
};

export const config = { path: "/api/auth-bff-registration-request" };
