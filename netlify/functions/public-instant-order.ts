import {
  ACCESS_COOKIE,
  SURFACE_COOKIE,
  allowedOrigin,
  parseCookies,
  secureJson,
  validCsrf,
} from "./_shared/session-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
  if (!Array.isArray(value) || value.length < 1 || value.length > 60) return null;
  let total = 0;
  const result: OrderItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as JsonObject;
    const flavorId = text(item.flavor_id, 36);
    const quantity = Number(item.quantity);
    if (!UUID.test(flavorId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 30) {
      return null;
    }
    total += quantity;
    if (total > 60) return null;

    let sauces: OrderItem["sauces"];
    if (item.sauces !== undefined) {
      if (!Array.isArray(item.sauces) || item.sauces.length > quantity) return null;
      sauces = [];
      for (const rawSauce of item.sauces) {
        if (!rawSauce || typeof rawSauce !== "object" || Array.isArray(rawSauce)) return null;
        const sauce = rawSauce as JsonObject;
        const unitNumber = Number(sauce.unit_number);
        const sauceId = sauce.sauce_id === null ? null : text(sauce.sauce_id, 36);
        if (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > quantity) return null;
        if (sauceId !== null && !UUID.test(sauceId)) return null;
        sauces.push({ unit_number: unitNumber, sauce_id: sauceId });
      }
    }
    result.push({ flavor_id: flavorId, quantity, ...(sauces ? { sauces } : {}) });
  }
  return result;
}

function normalizeReward(value: unknown): RewardChoice | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const reward = value as JsonObject;
  const flavorId = text(reward.flavor_id, 36);
  const sauceId = reward.sauce_id === null ? null : text(reward.sauce_id, 36);
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

function supabaseHeaders(publishableKey: string, bearer: string) {
  return {
    apikey: publishableKey,
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function rpc(
  supabaseUrl: string,
  publishableKey: string,
  bearer: string,
  name: string,
  params: JsonObject,
) {
  return fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: supabaseHeaders(publishableKey, bearer),
    body: JSON.stringify(params),
  });
}

async function options(
  supabaseUrl: string,
  publishableKey: string,
) {
  const headers = supabaseHeaders(publishableKey, publishableKey);
  const [saucesResponse, methodsResponse] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/order_sauces?select=id,name&active=eq.true&order=sort_order.asc,name.asc`,
      { headers },
    ),
    rpc(
      supabaseUrl,
      publishableKey,
      publishableKey,
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
  if (request.method !== "POST")
    return secureJson({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request, env("SITE_URL")))
    return secureJson({ error: "Origem não autorizada." }, 403);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey)
    return secureJson({ error: "Pedidos temporariamente indisponíveis." }, 503);

  const body = (await request.json().catch(() => ({}))) as JsonObject;
  const action = text(body.action, 32) as Action;
  if (!["options", "loyalty_preview", "quote", "submit"].includes(action))
    return secureJson({ error: "Ação inválida." }, 400);

  const cookies = parseCookies(request);
  const clientSession = cookies.get(SURFACE_COOKIE) === "client";
  const accessToken = clientSession ? cookies.get(ACCESS_COOKIE) || "" : "";
  const bearer = accessToken || publishableKey;

  try {
    if (action === "options") {
      return secureJson({ data: await options(supabaseUrl, publishableKey) });
    }

    if (action === "loyalty_preview") {
      if (!accessToken) return secureJson({ data: { recognized: false } });
      const phone = text(body.requested_phone, 32);
      const quantity = Number(body.requested_quantity);
      if (phone.replace(/\D/g, "").length < 10 || !Number.isInteger(quantity))
        return secureJson({ error: "Dados inválidos para consultar o Clube." }, 400);
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
        publishableKey,
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
          { error: upstreamError(data, "Não foi possível recalcular o pedido.") },
          upstream.status,
        );
      return secureJson({ data });
    }

    if (clientSession && !validCsrf(request))
      return secureJson({ error: "Validação CSRF inválida." }, 403);

    const customerName = text(body.requested_customer_name, 120);
    const customerPhone = text(body.requested_customer_phone, 32);
    const notes = text(body.requested_notes, 2000);
    const paymentMethod = text(body.requested_payment_method, 40);
    if (customerName.length < 3 || customerPhone.replace(/\D/g, "").length < 10)
      return secureJson({ error: "Informe nome e WhatsApp válidos." }, 400);
    if (!PAYMENT_CODE.test(paymentMethod))
      return secureJson({ error: "Forma de pagamento inválida." }, 400);

    const upstream = await rpc(
      supabaseUrl,
      publishableKey,
      bearer,
      "submit_instant_order_v5",
      {
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
