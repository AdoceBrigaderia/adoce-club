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