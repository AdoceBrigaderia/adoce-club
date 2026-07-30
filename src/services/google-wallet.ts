import { getBffSession, readBffCsrfToken } from "./bff-auth";

export type GoogleWalletPassResponse = {
  configured: true;
  save_url: string;
  object_id: string;
  member_code: string;
  generation_count: number;
  prepared_at: string;
};

type ErrorEnvelope = {
  error?: string;
  code?: string;
  missing?: string[];
};

async function request() {
  const csrfToken = readBffCsrfToken();
  if (!csrfToken) {
    const error = new Error("Entre novamente no Clube para continuar.") as Error & {
      code?: string;
    };
    error.code = "csrf_missing";
    throw error;
  }

  return fetch("/api/google-wallet-pass", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: "{}",
  });
}

async function parse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as
    | GoogleWalletPassResponse
    | ErrorEnvelope;
  if (!response.ok) {
    const failure = payload as ErrorEnvelope;
    const error = new Error(
      failure.error || "Não foi possível abrir a Carteira do Google.",
    ) as Error & {
      code?: string;
      status?: number;
      missing?: string[];
    };
    error.code = failure.code;
    error.status = response.status;
    error.missing = failure.missing;
    throw error;
  }
  return payload as GoogleWalletPassResponse;
}

export async function prepareGoogleWalletPass() {
  const first = await request();
  if (first.ok) return parse(first);

  const failure = (await first.clone().json().catch(() => ({}))) as ErrorEnvelope;
  if (first.status !== 401 || failure.code !== "session_refresh_required")
    return parse(first);

  const session = await getBffSession();
  if (!session || session.user.surface !== "client")
    throw new Error("Sua sessão do Clube expirou. Entre novamente.");

  return parse(await request());
}
