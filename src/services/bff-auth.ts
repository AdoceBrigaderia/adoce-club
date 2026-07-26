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
