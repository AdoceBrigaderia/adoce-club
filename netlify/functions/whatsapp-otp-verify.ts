import { createClient } from "@supabase/supabase-js";
import { guardBffRequest } from "./_shared/request-security";
import { secureJson } from "./_shared/session-security";
import { hashWhatsAppOtp } from "./_shared/whatsapp-otp-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

export default async (request: Request) => {
  const requestRejection = guardBffRequest(request, {
    methods: ["POST"],
    configuredSiteUrl: env("SITE_URL"),
  });
  if (requestRejection) return requestRejection;

  const body = (await request.json().catch(() => ({}))) as {
    challengeId?: string;
    code?: string;
  };
  const challengeId = body.challengeId?.trim() || "";
  const code = (body.code || "").replace(/\D/g, "");
  if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(code)) {
    return secureJson(
      { verified: false, error: "Código inválido ou expirado." },
      400,
    );
  }

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  const otpPepper = env("WHATSAPP_OTP_PEPPER") || "";
  if (!supabaseUrl || !secretKey || otpPepper.length < 32) {
    return secureJson(
      { verified: false, error: "Validação automática indisponível." },
      503,
    );
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const codeHash = hashWhatsAppOtp(challengeId, code, otpPepper);
  const { data, error } = await admin.rpc(
    "server_verify_whatsapp_auth_challenge",
    {
      challenge_id: challengeId,
      requested_code_hash: codeHash,
    },
  );
  if (error) {
    return secureJson(
      { verified: false, error: "Código inválido ou expirado." },
      400,
    );
  }

  const result = data as {
    verified?: boolean;
    reason?: string;
    purpose?: string;
    phone_e164?: string;
    profile_id?: string | null;
    attempts_remaining?: number;
  };
  if (!result.verified) {
    const blocked = result.reason === "blocked";
    return secureJson(
      {
        verified: false,
        error: blocked
          ? "Código bloqueado após muitas tentativas. Solicite outro código."
          : "Código inválido ou expirado.",
        attemptsRemaining:
          typeof result.attempts_remaining === "number"
            ? result.attempts_remaining
            : undefined,
      },
      blocked ? 429 : 400,
    );
  }

  return secureJson({
    verified: true,
    purpose: result.purpose || null,
    profileId: result.profile_id || null,
  });
};

export const config = { path: "/api/whatsapp-otp-verify" };
