import type { OperationBffRpcName } from "../../netlify/functions/_shared/bff-rpc-policy";
import { getBffSession, readBffCsrfToken } from "./bff-auth";

type BffRpcEnvelope<T> = {
  data?: T;
  error?: string;
  code?: string;
};

async function parseEnvelope<T>(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as BffRpcEnvelope<T>;
  if (!response.ok) {
    const error = new Error(payload.error || "Não foi possível concluir a operação.") as Error & {
      code?: string;
      status?: number;
    };
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload.data as T;
}

async function requestRpc<T>(
  rpc: OperationBffRpcName,
  params: Record<string, unknown>,
) {
  const csrfToken = readBffCsrfToken();
  if (!csrfToken) {
    const error = new Error("A sessão não possui validação CSRF.") as Error & {
      code?: string;
    };
    error.code = "csrf_missing";
    throw error;
  }

  const response = await fetch("/api/auth-bff-rpc", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ rpc, params }),
  });
  return { response, data: response.ok ? await parseEnvelope<T>(response) : undefined };
}

export async function bffRpc<T = unknown>(
  rpc: OperationBffRpcName,
  params: Record<string, unknown> = {},
): Promise<T> {
  const first = await requestRpc<T>(rpc, params);
  if (first.response.ok) return first.data as T;

  const errorPayload = (await first.response.json().catch(() => ({}))) as BffRpcEnvelope<T>;
  if (
    first.response.status !== 401 ||
    errorPayload.code !== "session_refresh_required"
  ) {
    const error = new Error(
      errorPayload.error || "Não foi possível concluir a operação.",
    ) as Error & { code?: string; status?: number };
    error.code = errorPayload.code;
    error.status = first.response.status;
    throw error;
  }

  const session = await getBffSession();
  if (!session) {
    const error = new Error("Sua sessão expirou. Entre novamente.") as Error & {
      code?: string;
      status?: number;
    };
    error.code = "session_expired";
    error.status = 401;
    throw error;
  }

  const retry = await requestRpc<T>(rpc, params);
  if (retry.response.ok) return retry.data as T;
  return parseEnvelope<T>(retry.response);
}
