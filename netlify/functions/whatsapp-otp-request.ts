import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendAuthenticationTemplate } from "./_shared/meta-whatsapp";
import { allowedOrigin, secureJson } from "./_shared/session-security";
import {
  generateWhatsAppOtp,
  hashRequestOrigin,
  hashWhatsAppOtp,
  readMetaWhatsAppConfig,
} from "./_shared/whatsapp-otp-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const acceptedPurposes = new Set([
  "registration",
  "recovery",
  "phone_change",
  "risk_check",
]);

export default async (request: Request) => {
  if (request.method !== "POST")
    return secureJson({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request, env("SITE_URL")))
    return secureJson({ error: "Origem não autorizada." }, 403);

  const body = (await request.json().catch(() => ({}))) as {
    phone?: string;
    purpose?: string;
    idempotencyKey?: string;
    profileId?: string | null;
  };
  const purpose = body.purpose || "registration";
  if (!acceptedPurposes.has(purpose))
    return secureJson({ error: "Finalidade de validação inválida." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  const otpPepper = env("WHATSAPP_OTP_PEPPER") || "";
  if (!supabaseUrl || !secretKey || otpPepper.length < 32) {
    return secureJson(
      { error: "Validação automática ainda não configurada neste ambiente." },
      503,
    );
  }

  let metaConfig;
  try {
    metaConfig = readMetaWhatsAppConfig(env);
  } catch {
    return secureJson(
      { error: "Validação automática ainda não configurada neste ambiente." },
      503,
    );
  }

  const challengeId = randomUUID();
  const code = generateWhatsAppOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const idempotencyKey =
    body.idempotencyKey?.trim() || `whatsapp-otp:${purpose}:${randomUUID()}`;
  if (idempotencyKey.length < 12 || idempotencyKey.length > 160) {
    return secureJson({ error: "Identificador da solicitação inválido." }, 400);
  }

  const forwardedIp =
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const codeHash = hashWhatsAppOtp(challengeId, code, otpPepper);
  const requestIpHash = hashRequestOrigin(forwardedIp, otpPepper);
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await admin.rpc(
      "server_create_whatsapp_auth_challenge",
      {
        challenge_id: challengeId,
        raw_phone: body.phone || "",
        requested_purpose: purpose,
        requested_code_hash: codeHash,
        requested_idempotency_key: idempotencyKey,
        requested_ip_hash: requestIpHash,
        requested_expires_at: expiresAt,
        requested_profile_id:
          body.profileId && /^[0-9a-f-]{36}$/i.test(body.profileId)
            ? body.profileId
            : null,
        requested_metadata: { channel: "whatsapp_cloud_api" },
      },
    );
    if (error) throw error;

    const challenge = data as {
      challenge_id?: string;
      phone_e164?: string;
      expires_at?: string;
      duplicate?: boolean;
      provider_message_id?: string | null;
      status?: string;
    };
    if (!challenge.challenge_id || !challenge.phone_e164) {
      throw new Error("Desafio de validação não criado.");
    }

    if (!challenge.duplicate) {
      try {
        const sent = await sendAuthenticationTemplate(
          metaConfig,
          challenge.phone_e164,
          code,
        );
        const { error: markError } = await admin.rpc(
          "server_mark_whatsapp_auth_sent",
          {
            challenge_id: challenge.challenge_id,
            provider_message_id: sent.messageId,
          },
        );
        if (markError) throw markError;
      } catch (sendError) {
        const providerError = sendError as Error & { providerCode?: string };
        await admin.rpc("server_mark_whatsapp_auth_failed", {
          challenge_id: challenge.challenge_id,
          error_code: providerError.providerCode || "send_failed",
          error_title: providerError.message,
        });
        return secureJson(
          {
            accepted: false,
            error:
              "Não foi possível enviar o código pelo WhatsApp agora. Use senha ou tente novamente em alguns minutos.",
          },
          503,
        );
      }
    }

    return secureJson(
      {
        accepted: true,
        challengeId: challenge.challenge_id,
        expiresAt: challenge.expires_at || expiresAt,
        duplicate: Boolean(challenge.duplicate),
      },
      202,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/Muitas solicitações/i.test(message)) {
      return secureJson(
        {
          accepted: false,
          error: "Muitas tentativas. Aguarde alguns minutos antes de pedir outro código.",
        },
        429,
      );
    }
    return secureJson(
      {
        accepted: false,
        error: "Não foi possível iniciar a validação pelo WhatsApp.",
      },
      400,
    );
  }
};

export const config = { path: "/api/whatsapp-otp-request" };
