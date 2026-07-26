import { requireSupabase } from "../lib/supabase";
import { normalizeBrazilPhone } from "./auth";

export type WhatsAppOtpPurpose =
  | "registration"
  | "recovery"
  | "phone_change"
  | "risk_check";

export type WhatsAppOtpChallenge = {
  accepted: true;
  challengeId: string;
  expiresAt: string;
  duplicate: boolean;
};

export type WhatsAppOtpVerification = {
  verified: true;
  purpose: WhatsAppOtpPurpose | null;
  profileId: string | null;
};

async function readPayload<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      body.error || "Não foi possível concluir a validação pelo WhatsApp.",
    );
  }
  return body;
}

export async function requestAutomaticWhatsAppOtp(input: {
  phone: string;
  purpose?: WhatsAppOtpPurpose;
  profileId?: string | null;
  idempotencyKey?: string;
}) {
  const response = await fetch("/api/whatsapp-otp-request", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: normalizeBrazilPhone(input.phone),
      purpose: input.purpose || "registration",
      profileId: input.profileId || null,
      idempotencyKey:
        input.idempotencyKey ||
        `whatsapp-otp:${input.purpose || "registration"}:${crypto.randomUUID()}`,
    }),
  });
  return readPayload<WhatsAppOtpChallenge>(response);
}

export async function verifyAutomaticWhatsAppOtp(
  challengeId: string,
  code: string,
) {
  const response = await fetch("/api/whatsapp-otp-verify", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      challengeId,
      code: code.replace(/\D/g, "").slice(0, 6),
    }),
  });
  return readPayload<WhatsAppOtpVerification>(response);
}

export async function claimVerifiedWhatsAppRegistration(challengeId: string) {
  const { data, error } = await requireSupabase().rpc(
    "customer_claim_verified_whatsapp_registration",
    { challenge_id: challengeId },
  );
  if (error) throw error;
  return data as {
    claimed: true;
    profile_id: string;
    phone_e164: string;
    whatsapp_verified_at: string;
  };
}
