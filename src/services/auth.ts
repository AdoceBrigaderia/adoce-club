import { requireSupabase } from "../lib/supabase";

export function normalizeBrazilPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;

  if (national.length !== 10 && national.length !== 11) {
    throw new Error("Informe um telefone com DDD.");
  }

  return "+55" + national;
}

export async function requestPhoneCode(fullName: string, phone: string) {
  const normalizedPhone = normalizeBrazilPhone(phone);
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    phone: normalizedPhone,
    options: {
      shouldCreateUser: true,
      data: { full_name: fullName.trim() },
    },
  });

  if (error) throw error;
  return normalizedPhone;
}

export async function requestEmailCode(email: string, fullName?: string, createUser = true) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    throw new Error("Informe um e-mail válido.");
  }

  const { error } = await requireSupabase().auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: createUser,
      data: fullName?.trim() ? { full_name: fullName.trim() } : undefined,
    },
  });

  if (error) throw error;
  return normalizedEmail;
}

export async function verifyEmailCode(email: string, token: string) {
  const { data, error } = await requireSupabase().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.replace(/\D/g, ""),
    type: "email",
  });

  if (error) throw error;
  return data;
}

export type WhatsAppChallenge = {
  challenge_id: string;
  phone_e164: string;
  verification_code: string;
  expires_at: string;
};

export async function beginWhatsAppVerification(phone: string) {
  const { data, error } = await requireSupabase().rpc(
    "begin_whatsapp_verification",
    { raw_phone: phone },
  );
  if (error) throw error;
  return data as WhatsAppChallenge;
}

export async function getWhatsAppVerificationStatus() {
  const { data, error } = await requireSupabase().rpc(
    "whatsapp_verification_status",
  );
  if (error) throw error;
  return data as { verified: boolean; phone_e164: string | null };
}

export function whatsappVerificationLink(challenge: WhatsAppChallenge) {
  const businessPhone =
    import.meta.env.VITE_META_WHATSAPP_BUSINESS_PHONE?.replace(/\D/g, "") ||
    "5585982156026";
  const message = `Olá, Adoce! Quero confirmar meu WhatsApp no Clube Adoce. Meu código é ${challenge.verification_code}`;
  return `https://wa.me/${businessPhone}?text=${encodeURIComponent(message)}`;
}

export async function verifyPhoneCode(phone: string, token: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    phone: normalizeBrazilPhone(phone),
    token: token.replace(/\D/g, ""),
    type: "sms",
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}
