import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Compartilhado somente entre funcoes; nao deve ser publicado como endpoint.

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

export const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

export const json = (
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });

export const whatsappAuthEnabled = () => env("WHATSAPP_AUTH_ENABLED") === "true";

export const whatsappAuthAccessMode = () => {
  const mode = env("WHATSAPP_AUTH_ACCESS_MODE");
  return mode === "pilot" || mode === "public" ? mode : "disabled";
};

export const allowedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const configured = env("SITE_URL")?.replace(/\/$/, "");
  return new Set(
    [
      configured,
      "https://www.adocebrigaderia.com.br",
      "https://adocebrigaderia.com.br",
      "https://clube.adocebrigaderia.com.br",
      "https://operacao.adocebrigaderia.com.br",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4182",
      "http://127.0.0.1:4182",
    ].filter(Boolean),
  ).has(origin);
};

export const normalizeBrazilPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  return national.length === 10 || national.length === 11
    ? `+55${national}`
    : null;
};

export const isValidFullName = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  return (
    normalized.length >= 5 &&
    normalized.length <= 120 &&
    !/[\u0000-\u001f\u007f]/.test(normalized) &&
    normalized.split(" ").filter((part) => part.length >= 2).length >= 2
  );
};

export const maskPhone = (phone: string) =>
  `+55 •• •••••-${phone.replace(/\D/g, "").slice(-4)}`;

export const clientIp = (request: Request) =>
  request.headers.get("x-nf-client-connection-ip") ||
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "unknown";

const bytesToHex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
}

export const serviceClient = () => {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export type WhatsAppRequestAuthorization = {
  pilot: boolean;
  actorUserId: string | null;
  errorResponse: Response | null;
};

export async function authorizeWhatsAppRequest(
  request: Request,
  admin: SupabaseClient,
): Promise<WhatsAppRequestAuthorization> {
  const mode = whatsappAuthAccessMode();
  if (mode === "disabled") {
    return {
      pilot: false,
      actorUserId: null,
      errorResponse: json({ error: "Acesso por WhatsApp ainda não está habilitado." }, 503),
    };
  }
  if (mode === "public") {
    return { pilot: false, actorUserId: null, errorResponse: null };
  }

  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!accessToken) {
    return {
      pilot: true,
      actorUserId: null,
      errorResponse: json({ error: "Sessão operacional obrigatória." }, 401),
    };
  }

  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return {
      pilot: true,
      actorUserId: null,
      errorResponse: json({ error: "Sessão inválida ou expirada." }, 401),
    };
  }
  const { data: staff, error: staffError } = await admin
    .from("staff_members")
    .select("role,active")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (staffError) {
    return {
      pilot: true,
      actorUserId: null,
      errorResponse: json({ error: "Não foi possível validar a permissão." }, 503),
    };
  }
  if (!staff?.active || !["owner", "manager"].includes(staff.role)) {
    return {
      pilot: true,
      actorUserId: null,
      errorResponse: json({ error: "Piloto restrito a proprietários e gerentes." }, 403),
    };
  }
  return {
    pilot: true,
    actorUserId: userData.user.id,
    errorResponse: null,
  };
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

export async function consumeRateLimit(
  client: SupabaseClient,
  bucket: string,
  subjectHash: string,
  windowSeconds: number,
  maxRequests: number,
) {
  const { data, error } = await client.rpc("consume_public_endpoint_rate_limit_bff", {
    requested_bucket: bucket,
    requested_subject_hash: subjectHash,
    requested_window_seconds: windowSeconds,
    requested_max_requests: maxRequests,
  });
  if (error) throw new Error("rate_limit_unavailable");
  return data as RateLimitResult;
}

const base64Bytes = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};

const constantTimeEqual = (left: Uint8Array, right: Uint8Array) => {
  const size = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < size; index += 1) {
    difference |= (left[index] || 0) ^ (right[index] || 0);
  }
  return difference === 0;
};

export async function verifyStandardWebhook(
  rawBody: string,
  headers: Headers,
  configuredSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const messageId = headers.get("webhook-id") || "";
  const timestampText = headers.get("webhook-timestamp") || "";
  const signatures = headers.get("webhook-signature") || "";
  const timestamp = Number(timestampText);
  if (!messageId || messageId.includes(".") || !Number.isInteger(timestamp) || !signatures) {
    return false;
  }
  if (Math.abs(nowSeconds - timestamp) > 300) return false;

  const serializedSecret = configuredSecret.includes(",")
    ? configuredSecret.split(",").at(-1) || ""
    : configuredSecret;
  const secret = serializedSecret.startsWith("whsec_")
    ? serializedSecret.slice("whsec_".length)
    : serializedSecret;
  if (!secret) return false;

  let secretBytes: Uint8Array;
  try {
    secretBytes = base64Bytes(secret);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(secretBytes).buffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = `${messageId}.${timestampText}.${rawBody}`;
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed)),
  );

  return signatures.split(" ").some((candidate) => {
    const [version, signature] = candidate.split(",");
    if (version !== "v1" || !signature) return false;
    try {
      return constantTimeEqual(base64Bytes(signature), expected);
    } catch {
      return false;
    }
  });
}

export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
