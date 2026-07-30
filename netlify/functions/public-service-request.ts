import {
  ipRateLimitRule,
  consumePublicRateLimits,
} from "./_shared/public-rate-limit";
import {
  ACCESS_COOKIE,
  SURFACE_COOKIE,
  parseCookies,
  secureJson,
} from "./_shared/session-security";
import { guardBffCsrf, guardBffRequest } from "./_shared/request-security";
import { sanitizeCakeBuilder } from "./_shared/cake-builder-input";
import { sanitizeProductConfiguration } from "./_shared/product-configuration-input";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type JsonObject = Record<string, unknown>;

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function upstreamMessage(value: unknown) {
  const payload = value as { message?: string; error?: string } | null;
  return (
    payload?.message ||
    payload?.error ||
    "Não foi possível registrar a pré-reserva agora."
  );
}

async function responsePayload(response: Response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { error: "Resposta inválida do serviço de dados." };
  }
}

async function optionalClientProfile(
  request: Request,
  supabaseUrl: string,
  publishableKey: string,
) {
  const cookies = parseCookies(request);
  if (cookies.get(SURFACE_COOKIE) !== "client") return null;
  const accessToken = cookies.get(ACCESS_COOKIE) || "";
  if (!accessToken) return null;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) return null;
    const user = (await response.json().catch(() => null)) as
      | { id?: string }
      | null;
    return user?.id && UUID.test(user.id) ? user.id : null;
  } catch {
    return null;
  }
}

export default async (request: Request) => {
  const requestRejection = guardBffRequest(request, {
    methods: ["POST"],
    configuredSiteUrl: env("SITE_URL"),
  });
  if (requestRejection) return requestRejection;

  const cookies = parseCookies(request);
  const authenticatedClient =
    cookies.get(SURFACE_COOKIE) === "client" &&
    Boolean(cookies.get(ACCESS_COOKIE));
  if (authenticatedClient) {
    const csrfRejection = guardBffCsrf(request);
    if (csrfRejection) return csrfRejection;
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_384)
    return secureJson({ error: "Solicitação maior que o permitido." }, 413);

  const body = (await request.json().catch(() => ({}))) as JsonObject;
  const operationKey = text(body.operation_key, 36);
  const productId = text(body.requested_product_id, 36);
  const storeId = text(body.requested_store_id, 36);
  const customerName = text(body.requested_customer_name, 120);
  const phoneDigits = text(body.requested_customer_phone, 24).replace(/\D/g, "");
  const customerEmail = text(body.requested_customer_email, 200).toLowerCase();
  const quantity = Number(body.requested_quantity);
  const requestedStart = text(body.requested_start, 40);
  const requestedEnd = text(body.requested_end, 40);
  const location = text(body.requested_location, 300);
  const notes = text(body.requested_notes, 2_000);
  const rawSelections = body.requested_selections;
  const selectionSource =
    rawSelections && typeof rawSelections === "object" && !Array.isArray(rawSelections)
      ? (rawSelections as JsonObject)
      : {};
  const preferences = text(selectionSource.preferences, 1_000);
  const cakeBuilder = sanitizeCakeBuilder(selectionSource.cake_builder);
  if (cakeBuilder === null)
    return secureJson({ error: "A montagem da torta contém uma opção inválida." }, 400);
  const productConfiguration = sanitizeProductConfiguration(
    selectionSource.product_configuration,
  );
  if (productConfiguration === null)
    return secureJson(
      { error: "A configuração do produto contém uma opção inválida." },
      400,
    );
  if (cakeBuilder && productConfiguration)
    return secureJson(
      { error: "A solicitação contém montadores incompatíveis." },
      400,
    );
  const selections: JsonObject = {
    preferences,
    ...(cakeBuilder ? { cake_builder: cakeBuilder } : {}),
    ...(productConfiguration
      ? { product_configuration: productConfiguration }
      : {}),
  };

  const start = Date.parse(requestedStart);
  const end = Date.parse(requestedEnd);
  if (!UUID.test(operationKey) || !UUID.test(productId))
    return secureJson({ error: "Solicitação inválida." }, 400);
  if (storeId && !UUID.test(storeId))
    return secureJson({ error: "Unidade inválida." }, 400);
  if (customerName.length < 2)
    return secureJson({ error: "Informe seu nome." }, 400);
  if (phoneDigits.length < 10 || phoneDigits.length > 13)
    return secureJson({ error: "Informe um WhatsApp válido com DDD." }, 400);
  if (customerEmail && !EMAIL.test(customerEmail))
    return secureJson({ error: "Informe um e-mail válido." }, 400);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000)
    return secureJson({ error: "Quantidade inválida." }, 400);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return secureJson({ error: "Data ou horário inválido." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey =
    env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey)
    return secureJson(
      { error: "Canal de pré-reserva temporariamente indisponível." },
      503,
    );

  const rateLimit = await consumePublicRateLimits({
    supabaseUrl,
    secretKey,
    pepper:
      env("PUBLIC_RATE_LIMIT_PEPPER") ||
      env("WHATSAPP_OTP_PEPPER") ||
      secretKey,
    rules: [
      ipRateLimitRule(request, "service-request:ip", 3600, 20),
      {
        bucket: "service-request:phone",
        subject: `phone:${phoneDigits}`,
        windowSeconds: 3600,
        maxRequests: 5,
      },
    ],
  });
  if (!rateLimit.allowed) {
    return secureJson(
      {
        error: rateLimit.failed
          ? "Canal de pré-reserva temporariamente indisponível."
          : "Muitas tentativas. Aguarde antes de enviar outra pré-reserva.",
        code: rateLimit.failed ? "rate_limit_unavailable" : "rate_limited",
        retry_after_seconds: rateLimit.retryAfterSeconds,
      },
      rateLimit.failed ? 503 : 429,
    );
  }

  const profileId = await optionalClientProfile(
    request,
    supabaseUrl,
    publishableKey,
  );

  try {
    const upstream = await fetch(
      `${supabaseUrl}/rest/v1/rpc/submit_service_request_bff`,
      {
        method: "POST",
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requested_operation_key: operationKey,
          requested_product_id: productId,
          requested_store_id: storeId || null,
          requested_customer_name: customerName,
          requested_customer_phone: phoneDigits,
          requested_customer_email: customerEmail || null,
          requested_quantity: quantity,
          requested_start: new Date(start).toISOString(),
          requested_end: new Date(end).toISOString(),
          requested_location: location,
          requested_selections: selections,
          requested_notes: notes,
          requested_profile_id: profileId,
        }),
      },
    );
    const payload = await responsePayload(upstream);
    if (!upstream.ok) {
      return secureJson(
        {
          error: upstreamMessage(payload),
          code: "service_request_rejected",
        },
        upstream.status >= 500 ? 502 : 400,
      );
    }
    return secureJson({ data: payload }, 201);
  } catch {
    return secureJson(
      {
        error: "Não foi possível registrar a pré-reserva agora.",
        code: "service_request_unavailable",
      },
      503,
    );
  }
};

export const config = { path: "/api/public-service-request" };
