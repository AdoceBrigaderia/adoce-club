import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  submitPublicServiceRequest,
  type PublicServiceRequestInput,
} from "../services/public-service-request";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

/**
 * Compatibilidade temporária com módulos legados de desenvolvimento.
 * A preferência de persistência não grava mais qualquer dado no navegador.
 * As superfícies reais de cliente e operação usam somente o BFF e cookies HttpOnly.
 */
export function setRememberLogin(_remember: boolean) {
  return undefined;
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

const rawSupabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

type RpcResponse = {
  data: unknown;
  error: null | {
    message: string;
    details: string;
    hint: string;
    code: string;
  };
  count: null;
  status: number;
  statusText: string;
};

async function protectedServiceRequestRpc(
  args: Record<string, unknown> | undefined,
): Promise<RpcResponse> {
  try {
    const data = await submitPublicServiceRequest(
      (args || {}) as PublicServiceRequestInput,
    );
    return {
      data,
      error: null,
      count: null,
      status: 201,
      statusText: "Created",
    };
  } catch (cause) {
    const error = cause as Error & { code?: string; status?: number };
    return {
      data: null,
      error: {
        message: error.message || "Não foi possível registrar a pré-reserva.",
        details: "",
        hint: "",
        code: error.code || "public_service_request_failed",
      },
      count: null,
      status: error.status || 500,
      statusText: "Request Failed",
    };
  }
}

function guardSensitiveBrowserWrites(client: SupabaseClient) {
  const originalRpc = client.rpc.bind(client) as (...args: unknown[]) => unknown;
  return new Proxy(client, {
    get(target, property) {
      if (property === "rpc") {
        return (
          functionName: string,
          args?: Record<string, unknown>,
          options?: unknown,
        ) => {
          if (functionName === "submit_service_request") {
            return protectedServiceRequestRpc(args);
          }
          return originalRpc(functionName, args, options);
        };
      }

      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as SupabaseClient;
}

export const supabase: SupabaseClient | null = rawSupabase
  ? guardSensitiveBrowserWrites(rawSupabase)
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("Backend ainda não configurado neste ambiente.");
  }

  return supabase;
}
