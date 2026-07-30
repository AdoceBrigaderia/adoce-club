import {
  consumePublicRateLimits,
  ipRateLimitRule,
} from "./_shared/public-rate-limit";
import { guardBffRequest } from "./_shared/request-security";
import { secureJson } from "./_shared/session-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_EVENTS = new Set([
  "page_view",
  "whatsapp_click",
  "product_view",
  "prebook_start",
  "prebook_submit",
  "prebook_success",
  "prebook_error",
  "schedule_open",
  "instant_order_open",
  "instant_order_start",
  "instant_order_success",
  "pede_junto_start",
  "club_join_start",
]);
const ALLOWED_PROPERTIES = new Set([
  "segment",
  "product_id",
  "product_slug",
  "source",
  "channel",
  "result",
  "device",
  "quantity",
  "checkout_mode",
]);

type JsonObject = Record<string, unknown>;

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeProperties(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: JsonObject = {};
  for (const [key, raw] of Object.entries(value as JsonObject)) {
    if (!ALLOWED_PROPERTIES.has(key)) continue;
    if (typeof raw === "boolean") next[key] = raw;
    else if (typeof raw === "number" && Number.isFinite(raw))
      next[key] = Math.max(-1_000_000, Math.min(raw, 1_000_000));
    else if (typeof raw === "string") next[key] = raw.trim().slice(0, 160);
  }
  return next;
}

export default async (request: Request) => {
  const requestRejection = guardBffRequest(request, {
    methods: ["POST"],
    configuredSiteUrl: env("SITE_URL"),
  });
  if (requestRejection) return requestRejection;

  const body = (await request.json().catch(() => ({}))) as JsonObject;
  const eventId = text(body.event_id, 36);
  const eventName = text(body.event_name, 48);
  const pagePath = text(body.page_path, 160);
  if (!UUID.test(eventId) || !ALLOWED_EVENTS.has(eventName))
    return secureJson({ error: "Evento inválido." }, 400);
  if (!pagePath.startsWith("/") || /[\r\n]/.test(pagePath))
    return secureJson({ error: "Página inválida." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const secretKey =
    env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secretKey)
    return secureJson({ accepted: false }, 202);

  const rateLimit = await consumePublicRateLimits({
    supabaseUrl,
    secretKey,
    pepper:
      env("PUBLIC_RATE_LIMIT_PEPPER") ||
      env("WHATSAPP_OTP_PEPPER") ||
      secretKey,
    rules: [ipRateLimitRule(request, "analytics:ip", 3600, 300)],
  });
  if (!rateLimit.allowed)
    return secureJson(
      {
        accepted: false,
        rate_limited: !rateLimit.failed,
      },
      202,
    );

  try {
    const upstream = await fetch(
      `${supabaseUrl}/rest/v1/rpc/record_site_analytics_event`,
      {
        method: "POST",
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          requested_event_id: eventId,
          requested_event_name: eventName,
          requested_page_path: pagePath,
          requested_properties: safeProperties(body.properties),
        }),
      },
    );
    return secureJson({ accepted: upstream.ok }, upstream.ok ? 202 : 502);
  } catch {
    return secureJson({ accepted: false }, 202);
  }
};

export const config = { path: "/api/public-analytics-event" };
