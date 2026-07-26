export type BffAuthSurface = "client" | "operation";

export type BffUser = {
  id: string;
  email?: string | null;
  fullName?: string;
  phone?: string | null;
  surface: BffAuthSurface;
  role: string;
};

export type BffSession = {
  authenticated: true;
  user: BffUser;
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt: string | null;
  rotated?: boolean;
};

export type BffRegistrationResult = {
  authenticated: true;
  completed: true;
  user: BffUser;
  registration: {
    completed: true;
    profile_id: string;
    full_name: string;
    phone_e164: string;
    whatsapp_verified_at: string | null;
    marketing_consent: boolean;
    referral_status: string;
  };
  csrfToken: string;
  expiresIn: number;
};

const csrfCookieName = "__Host-adoce-csrf";

export function readBffCsrfToken(cookieHeader = document.cookie) {
  const prefix = `${csrfCookieName}=`;
  const entry = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!entry) return "";
  try {
    return decodeURIComponent(entry.slice(prefix.length));
  } catch {
    return "";
  }
}

async function payload<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error || "Não foi possível concluir a autenticação.");
  }
  return body;
}

export async function bffPasswordLogin(input: {
  phone: string;
  password: string;
  surface: BffAuthSurface;
  remember: boolean;
}) {
  const response = await fetch("/api/auth-bff-login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload<BffSession & { csrfToken: string; expiresIn: number }>(response);
}

export async function bffRequestRegistrationEmailCode(input: {
  email: string;
  fullName: string;
}) {
  const response = await fetch("/api/auth-bff-registration-request", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return payload<{ accepted: true }>(response);
}

export async function bffCompleteRegistration(input: {
  email: string;
  token: string;
  fullName: string;
  phone: string;
  marketingAccepted: boolean;
  whatsappChallengeId?: string | null;
  referralCode?: string | null;
  remember?: boolean;
}) {
  const response = await fetch("/api/auth-bff-registration-complete", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return payload<BffRegistrationResult>(response);
}

export async function getBffSession() {
  const response = await fetch("/api/auth-bff-session", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (response.status === 401 || response.status === 403) return null;
  return payload<BffSession>(response);
}

export async function bffLogout() {
  const csrfToken = readBffCsrfToken();
  if (!csrfToken) throw new Error("A sessão não possui validação CSRF.");
  const response = await fetch("/api/auth-bff-logout", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "X-CSRF-Token": csrfToken,
    },
  });
  await payload<{ loggedOut: true }>(response);
}
