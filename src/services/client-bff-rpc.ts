import type { ClientBffRpcName } from "../../netlify/functions/_shared/bff-rpc-policy";
import { getBffSession, readBffCsrfToken } from "./bff-auth";

type Envelope<T> = { data?: T; error?: string; code?: string };

async function parse<T>(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as Envelope<T>;
  if (!response.ok) {
    const error = new Error(payload.error || "Não foi possível concluir o check-in.") as Error & {
      code?: string;
      status?: number;
    };
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload.data as T;
}

async function request<T>(rpc: ClientBffRpcName, params: Record<string, unknown>) {
  const csrfToken = readBffCsrfToken();
  if (!csrfToken) {
    const error = new Error("Entre novamente no Clube para continuar.") as Error & {
      code?: string;
    };
    error.code = "csrf_missing";
    throw error;
  }
  return fetch("/api/auth-bff-client-rpc", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ rpc, params }),
  });
}

export async function clientBffRpc<T = unknown>(
  rpc: ClientBffRpcName,
  params: Record<string, unknown> = {},
): Promise<T> {
  const first = await request<T>(rpc, params);
  if (first.ok) return parse<T>(first);

  const failure = (await first.json().catch(() => ({}))) as Envelope<T>;
  if (first.status !== 401 || failure.code !== "session_refresh_required") {
    const error = new Error(failure.error || "Não foi possível concluir o check-in.") as Error & {
      code?: string;
      status?: number;
    };
    error.code = failure.code;
    error.status = first.status;
    throw error;
  }

  const session = await getBffSession();
  if (!session || session.user.surface !== "client") {
    throw new Error("Sua sessão do Clube expirou. Entre novamente.");
  }
  return parse<T>(await request<T>(rpc, params));
}
