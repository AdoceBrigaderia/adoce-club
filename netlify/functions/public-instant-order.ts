import {
  ACCESS_COOKIE,
  SURFACE_COOKIE,
  parseCookies,
  secureJson,
} from "./_shared/session-security";
import { guardBffCsrf, guardBffRequest } from "./_shared/request-security";
import {
  consumePublicRateLimits,
  ipRateLimitRule,
} from "./_shared/public-rate-limit";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYMENT_CODE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

type Action = "options" | "loyalty_preview" | "quote" | "submit";
type JsonObject = Record<string, unknown>;
type OrderItem = {
  flavor_id: string;
  quantity: number;
  sauces?: Array<{ unit_number: number; sauce_id: string | null }>;
};
type RewardChoice = { flavor_id: string; sauce_id: string | null };

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeItems(value: unknown): OrderItem[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 60)
    return null;
  let total = 0;
  const result: OrderItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as JsonObject;
    const flavorId = text(item.flavor_id, 36);
    const quantity = Number(item.quantity);
    if (
      !UUID.test(flavorId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 30
    ) {
      return null;
    }
    total += quantity;
    if (total > 60) return null;

    let sauces: OrderItem["sauces"];
    if (item.sauces !== undefined) {
      if (!Array.isArray(item.sauces) || item.sauces.length > quantity)
        return null;
      sauces = [];
      for (const rawSauce of item.sauces) {
        if (
          !rawSauce ||
          typeof rawSauce !== "object" ||
          Array.isArray(rawSauce)
        )
          return null;
        const sauce = rawSauce as JsonObject;
        const unitNumber = Number(sauce.unit_number);
        const sauceId =
          sauce.sauce_id === null ? null : text(sauce.sauce_id, 36);
        if (
          !Number.isInteger(unitNumber) ||
          unitNumber < 1 ||
          unitNumber > quantity
        )
          return null;
        if (sauceId !== null && !UUID.test(sauceId)) return null;
        sauces.push({ unit_number: unitNumber, sauce_id: sauceId });
      }
    }
    result.push({
      flavor_id: flavorId,
      quantity,
      ...(sauces ? { sauces } : {}),
    });
  }
  return result;
}

function normalizeReward(value: unknown): RewardChoice | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const reward = value as JsonObject;
  const flavorId = text(reward.flavor_id, 36);
  const sauceId =
    reward.sauce_id === null ? null : text(reward.sauce_id, 36);
  if (!UUID.test(flavorId)) return undefined;
  if (sauceId !== null && !UUID.test(sauceId)) return undefined;
  return { flavor_id: flavorId, sauce_id: sauceId };
}

async function payload(response: Response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { error: "Resposta inválida do serviço de dados." };
  }
}

function upstreamError(value: unknown, fallback: string) {
  const source = value as { message?: string; error?: string } | null;
  return source?.message || source?.error || fallback;
}

function supabaseHeaders(apiKey: string, bearer: string) {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function rpc(
  supabaseUrl: string,
  apiKey: string,
  bearer: string,
  name: string,
  params: JsonObject,
) {
  return fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: supabaseHeaders(apiKey, bearer),
    body: JSON.stringify(params),
  });
}

async function options(supabaseUrl: string, secretKey: string) {
  const headers = supabaseHeaders(secretKey, secretKey);
  const [saucesResponse, methodsResponse] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/order_sauces?select=id,name&active=eq.true&order=sort_order.asc,name.asc`,
      { headers },
    ),
    rpc(
      supabaseUrl,
      secretKey,
      secretKey,
      "get_checkout_payment_methods",
      {},
    ),
  ]);
  const sauces = await payload(saucesResponse);
  const paymentMethods = await payload(methodsResponse);
  if (!saucesResponse.ok || !methodsResponse.ok) {
    throw new Error(
      upstreamError(
        !saucesResponse.ok ? sauces : paymentMethods,
        "Não foi possível carregar as opções do pedido.",
      ),
    );
  }
  return { sauces, paymentMethods };
}

export default async (request: Request) => {
  const requestRejection = guardBffRequest(request, {
    methods: ["POST"],
    configuredSiteUrl: env("SITE_URL"),
  });
  if (requestRejection) return requestRejection;

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 32_768)
    return secureJson({ error: "Pedido maior que o permitido." }, 413);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey =
    env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey)
    return secureJson(
      { error: "Pedidos temporariamente indisponíveis." },
      503,
    );

  const body = (await request.json().catch(() => ({}))) as JsonObject;
  const action = text(body.action, 32) as Action;
  if (!["options", "loyalty_preview", "quote", "submit"].includes(action))
    return secureJson({ error: "Ação inválida." }, 400);

  const cookies = parseCookies(request);
  const clientSession = cookies.get(SURFACE_COOKIE) === "client";
  const accessToken = clientSession ? cookies.get(ACCESS_COOKIE) || "" : "";
  const apiKey = accessToken ? publishableKey : secretKey;
  const bearer = accessToken || secretKey;

  try {
    if (action === "options") {
      return secureJson({ data: await options(supabaseUrl, secretKey) });
    }

    if (action === "loyalty_preview") {
      if (!accessToken) return secureJson({ data: { recognized: false } });
      const phone = text(body.requested_phone, 32);
      const quantity = Number(body.requested_quantity);
      if (
        phone.replace(/\D/g, "").length < 10 ||
        !Number.isInteger(quantity)
      )
        return secureJson(
          { error: "Dados inválidos para consultar o Clube." },
          400,
        );
      const upstream = await rpc(
        supabaseUrl,
        publishableKey,
        accessToken,
        "member_instant_order_loyalty_preview",
        {
          requested_phone: phone,
          requested_quantity: Math.max(0, Math.min(quantity, 60)),
        },
      );
      const data = await payload(upstream);
      if (upstream.status === 401)
        return secureJson(
          { error: "Sessão expirada.", code: "session_refresh_required" },
          401,
        );
      if (!upstream.ok)
        return secureJson(
          { error: upstreamError(data, "Não foi possível consultar o Clube.") },
          upstream.status,
        );
      return secureJson({ data });
    }

    const items = normalizeItems(body.requested_items);
    const reward = normalizeReward(body.requested_reward);
    if (!items || reward === undefined)
      return secureJson({ error: "Revise os itens do pedido." }, 400);

    if (action === "quote") {
      const upstream = await rpc(
        supabaseUrl,
        apiKey,
        bearer,
        "public_quote_instant_order",
        { requested_items: items, requested_reward: reward },
      );
      const data = await payload(upstream);
      if (upstream.status === 401)
        return secureJson(
          { error: "Sessão expirada.", code: "session_refresh_required" },
          401,
        );
      if (!upstream.ok)
        return secureJson(
          {
            error: upstreamError(data, "Não foi possível recalcular o pedido."),
          },
          upstream.status,
        );
      return secureJson({ data });
    }

    if (accessToken) {
      const csrfRejection = guardBffCsrf(request);
      if (csrfRejection) return csrfRejection;
    }

    const customerName = text(body.requested_customer_name, 120);
    const customerPhone = text(body.requested_customer_phone, 32);
    const customerPhoneDigits = customerPhone.replace(/\D/g, "");
    const notes = text(body.requested_notes, 2000);
    const paymentMethod = text(body.requested_payment_method, 40);
    const operationKey = text(body.requested_operation_key, 36);
    if (
      customerName.length < 3 ||
      customerPhoneDigits.length < 10
    )
      return secureJson({ error: "Informe nome e WhatsApp válidos." }, 400);
    if (!PAYMENT_CODE.test(paymentMethod))
      return secureJson({ error: "Forma de pagamento inválida." }, 400);
    if (!UUID.test(operationKey))
      return secureJson({ error: "Identificação do pedido inválida." }, 400);

    const rateLimit = await consumePublicRateLimits({
      supabaseUrl,
      secretKey,
      pepper:
        env("PUBLIC_RATE_LIMIT_PEPPER") ||
        env("WHATSAPP_OTP_PEPPER") ||
        secretKey,
      rules: [
        ipRateLimitRule(request, "instant-order:ip", 3600, 30),
        {
          bucket: "instant-order:phone",
          subject: `phone:${customerPhoneDigits}`,
          windowSeconds: 3600,
          maxRequests: 8,
        },
      ],
    });
    if (!rateLimit.allowed) {
      return secureJson(
        {
          error: rateLimit.failed
            ? "Pedidos temporariamente indisponíveis."
            : "Muitas tentativas. Aguarde antes de enviar outro pedido.",
          code: rateLimit.failed ? "rate_limit_unavailable" : "rate_limited",
          retry_after_seconds: rateLimit.retryAfterSeconds,
        },
        rateLimit.failed ? 503 : 429,
      );
    }

    const upstream = await rpc(
      supabaseUrl,
      apiKey,
      bearer,
      "submit_instant_order_v6",
      {
        requested_operation_key: operationKey,
        requested_customer_name: customerName,
        requested_customer_phone: customerPhone,
        requested_items: items,
        requested_notes: notes,
        requested_payment_method: paymentMethod,
        requested_reward: reward,
      },
    );
    const data = await payload(upstream);
    if (upstream.status === 401)
      return secureJson(
        { error: "Sessão expirada.", code: "session_refresh_required" },
        401,
      );
    if (!upstream.ok)
      return secureJson(
        { error: upstreamError(data, "Não foi possível enviar o pedido.") },
        upstream.status,
      );
    return secureJson({ data }, 200);
  } catch (error) {
    return secureJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível concluir o pedido agora.",
      },
      502,
    );
  }
};

export const config = { path: "/api/public-instant-order" };
