import { requireSupabase, setRememberLogin } from "../lib/supabase";

export type SocialAuthProvider = "google" | "facebook";
export type SocialAuthReturn = "clube" | "operacao";

export function buildSocialAuthRedirectUrl(
  currentHref: string,
  destination: SocialAuthReturn = "clube",
): string {
  const url = new URL(currentHref);
  url.hash = "";
  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  url.searchParams.set("auth_return", destination);
  return url.toString();
}

export async function signInWithSocialProvider(
  provider: SocialAuthProvider,
  remember = true,
  destination: SocialAuthReturn = "clube",
) {
  setRememberLogin(remember);
  const { data, error } = await requireSupabase().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: buildSocialAuthRedirectUrl(window.location.href, destination),
      ...(provider === "facebook" ? { scopes: "email,public_profile" } : {}),
    },
  });

  if (error) {
    const providerName = provider === "google" ? "Google" : "Facebook";
    throw new Error(
      `Não foi possível iniciar o acesso com ${providerName}. Tente novamente ou use celular e senha.`,
    );
  }
  return data;
}

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

export type WhatsAppAuthRequest = {
  challengeId: string;
  phone: string;
  maskedPhone: string;
  expiresIn: number;
  resendAfter: number;
};

export async function requestWhatsAppAuthCode(fullName: string, phone: string) {
  const normalizedPhone = normalizeBrazilPhone(phone);
  const response = await fetch("/api/auth/whatsapp/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      phone: normalizedPhone,
      fullName: fullName.trim(),
      intent: "signup_or_login",
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    challenge_id?: string;
    masked_phone?: string;
    expires_in?: number;
    resend_after?: number;
    error?: string;
  };
  if (!response.ok || !payload.challenge_id)
    throw new Error(payload.error || "Não foi possível enviar o código agora.");
  return {
    challengeId: payload.challenge_id,
    phone: normalizedPhone,
    maskedPhone: payload.masked_phone || normalizedPhone,
    expiresIn: payload.expires_in || 600,
    resendAfter: payload.resend_after || 60,
  } satisfies WhatsAppAuthRequest;
}

export async function verifyWhatsAppAuthCode(
  challengeId: string,
  phone: string,
  token: string,
) {
  const response = await fetch("/api/auth/whatsapp/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challengeId,
      phone: normalizeBrazilPhone(phone),
      code: token.replace(/\D/g, ""),
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    session?: { access_token?: string; refresh_token?: string };
    error?: string;
  };
  if (!response.ok || !payload.session?.access_token || !payload.session.refresh_token)
    throw new Error(payload.error || "Código inválido ou expirado.");
  const { data, error } = await requireSupabase().auth.setSession({
    access_token: payload.session.access_token,
    refresh_token: payload.session.refresh_token,
  });
  if (error) throw error;
  return data;
}

export async function requestPasswordReset(input: { email?: string; phone?: string }) {
  const response = await fetch("/api/request-password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email?.trim().toLowerCase() || undefined,
      phone: input.phone?.trim() || undefined,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    sent?: boolean;
    email?: string;
    hint?: string;
    error?: string;
  };
  if (!response.ok || !payload.sent) {
    throw new Error(payload.error || "Não foi possível enviar o acesso agora.");
  }
  return payload;
}

export async function requestEmailCode(email: string, fullName?: string, createUser = false) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    throw new Error("Informe um e-mail válido.");
  }

  const response = await fetch("/api/request-email-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: normalizedEmail,
      fullName: fullName?.trim() || undefined,
      createUser,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    sent?: boolean;
    error?: string;
  };
  if (!response.ok || !payload.sent) {
    throw new Error(payload.error || "Não foi possível enviar o código agora.");
  }
  return normalizedEmail;
}

export async function verifyEmailCode(email: string, token: string) {
  const response = await fetch("/api/verify-email-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      token: token.replace(/\D/g, ""),
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
  };
  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(payload.error || "Código inválido ou expirado.");
  }
  const { data, error } = await requireSupabase().auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });
  if (error) throw error;
  return data;
}

export async function signInWithPhonePassword(
  phone: string,
  password: string,
  remember = true,
) {
  setRememberLogin(remember);
  const request: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: normalizeBrazilPhone(phone), password }),
  };
  const response = await fetch("/api/customer-phone-login", request);
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    homologation_demo?: boolean;
    must_change_password?: boolean;
    error?: string;
  };
  if (response.ok && payload.homologation_demo)
    return { homologationDemo: true, mustChangePassword: false };
  if (!response.ok || !payload.access_token || !payload.refresh_token)
    throw new Error(payload.error || "Não foi possível entrar agora.");
  const { data, error } = await requireSupabase().auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });
  if (error) throw error;
  return {
    ...data,
    homologationDemo: false,
    mustChangePassword: Boolean(payload.must_change_password),
  };
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
  remember = true,
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    throw new Error("Informe um e-mail válido.");
  }

  setRememberLogin(remember);
  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) throw new Error("E-mail ou senha incorretos.");
  return data;
}

export async function signInWithStaffPhonePassword(
  phone: string,
  password: string,
  remember = true,
) {
  setRememberLogin(remember);
  const request: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: normalizeBrazilPhone(phone),
      password,
    }),
  };
  const response = await fetch("/api/staff-phone-login", request);
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    must_change_password?: boolean;
    homologation_demo?: boolean;
    error?: string;
  };
  if (response.ok && payload.homologation_demo)
    return { homologationDemo: true, mustChangePassword: false };
  if (!response.ok || !payload.access_token || !payload.refresh_token)
    throw new Error(payload.error || "Não foi possível entrar agora.");
  const { data, error } = await requireSupabase().auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });
  if (error) throw error;
  return {
    ...data,
    homologationDemo: false,
    mustChangePassword: Boolean(payload.must_change_password),
  };
}

export async function resetUserPasswordByManager(
  accessToken: string,
  targetUserId: string,
  targetKind: "staff" | "customer",
) {
  const response = await fetch("/api/admin-reset-user-password", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetUserId, targetKind }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    reset?: boolean;
    fullName?: string;
    temporaryPassword?: string;
    mustChangePassword?: boolean;
    error?: string;
  };
  if (!response.ok || !payload.reset)
    throw new Error(
      payload.error || "Não foi possível redefinir a senha.",
    );
  return payload;
}

export async function upgradeCustomerSecurity(
  accessToken: string,
  phone: string,
  password: string,
) {
  const response = await fetch("/api/customer-security-upgrade", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone, password }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    upgraded?: boolean;
    error?: string;
  };
  if (!response.ok || !payload.upgraded) {
    throw new Error(payload.error || "Não foi possível criar seu acesso seguro.");
  }
  return payload;
}

export async function registerCustomerPasskey() {
  const client = requireSupabase();
  const result = await client.auth.registerPasskey();
  if (result.error) throw result.error;
  return result.data;
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
