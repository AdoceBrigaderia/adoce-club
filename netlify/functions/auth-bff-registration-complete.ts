import { createClient } from "@supabase/supabase-js";
import { guardBffRequest } from "./_shared/request-security";
import {
  secureJson,
  sessionCookies,
  type SupabaseTokenPayload,
} from "./_shared/session-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  return national.length === 10 || national.length === 11
    ? `+55${national}`
    : null;
};

async function revokeSession(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
) {
  await fetch(`${supabaseUrl}/auth/v1/logout?scope=global`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(() => undefined);
}

export default async (request: Request) => {
  const requestRejection = guardBffRequest(request, {
    methods: ["POST"],
    configuredSiteUrl: env("SITE_URL"),
  });
  if (requestRejection) return requestRejection;

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    token?: string;
    fullName?: string;
    phone?: string;
    legalAccepted?: boolean;
    marketingAccepted?: boolean;
    whatsappChallengeId?: string | null;
    referralCode?: string | null;
    remember?: boolean;
  };
  const email = normalizeEmail(body.email || "");
  const token = (body.token || "").replace(/\D/g, "").slice(0, 6);
  const fullName = (body.fullName || "").trim().replace(/\s+/g, " ").slice(0, 160);
  const phone = normalizePhone(body.phone || "");
  const challengeId = body.whatsappChallengeId?.trim() || null;
  const referralCode = body.referralCode?.trim().toUpperCase().slice(0, 80) || null;

  if (!/^\S+@\S+\.\S+$/.test(email) || token.length !== 6 || !phone || fullName.length < 5)
    return secureJson({ error: "Revise os dados e o código informado." }, 400);
  if (body.legalAccepted !== true)
    return secureJson(
      {
        error:
          "Confirme os Termos do Clube e a Política de Privacidade para concluir o cadastro.",
      },
      400,
    );
  if (challengeId && !/^[0-9a-f-]{36}$/i.test(challengeId))
    return secureJson({ error: "Validação do WhatsApp inválida." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey)
    return secureJson({ error: "Cadastro temporariamente indisponível." }, 503);

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  const session = data.session;
  if (error || !data.user || !session?.access_token || !session.refresh_token)
    return secureJson({ error: "Código inválido ou expirado." }, 401);

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: registration, error: registrationError } = await userClient.rpc(
    "customer_complete_registration",
    {
      next_full_name: fullName,
      next_phone_e164: phone,
      next_legal_accepted: true,
      next_marketing: Boolean(body.marketingAccepted),
      target_whatsapp_challenge_id: challengeId,
      target_referral_code: referralCode,
    },
  );

  if (registrationError) {
    await revokeSession(supabaseUrl, publishableKey, session.access_token);
    return secureJson(
      {
        error:
          registrationError.message ||
          "Não foi possível concluir seu cadastro. Solicite um novo código.",
      },
      400,
    );
  }

  const cookieSession = sessionCookies(
    session as SupabaseTokenPayload,
    "client",
    body.remember !== false,
  );

  return secureJson(
    {
      authenticated: true,
      completed: true,
      user: {
        id: data.user.id,
        surface: "client",
        role: "customer",
      },
      registration,
      csrfToken: cookieSession.csrfToken,
      expiresIn: Math.min(Number(session.expires_in) || 900, 900),
    },
    200,
    cookieSession.values,
  );
};

export const config = { path: "/api/auth-bff-registration-complete" };
