import { createClient } from "@supabase/supabase-js";
import { guardBffRequest } from "./_shared/request-security";
import {
  ACCESS_COOKIE,
  SURFACE_COOKIE,
  parseCookies,
  secureJson,
} from "./_shared/session-security";
import { normalizeMetaGraphVersion } from "./_shared/meta-whatsapp";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const suffix = (value: string | undefined) =>
  value && value.length >= 4 ? `••••${value.slice(-4)}` : null;

export default async (request: Request) => {
  const requestRejection = guardBffRequest(request, {
    methods: ["GET"],
    configuredSiteUrl: env("SITE_URL"),
  });
  if (requestRejection) return requestRejection;

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey)
    return secureJson({ error: "Integração indisponível neste ambiente." }, 503);

  const cookies = parseCookies(request);
  if (cookies.get(SURFACE_COOKIE) !== "operation")
    return secureJson({ error: "Sessão operacional obrigatória." }, 403);

  const accessToken = cookies.get(ACCESS_COOKIE) || "";
  if (!accessToken)
    return secureJson(
      { error: "Sessão obrigatória.", code: "session_refresh_required" },
      401,
    );

  const sessionClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } =
    await sessionClient.auth.getUser(accessToken);
  if (userError || !userData.user)
    return secureJson(
      { error: "Sessão expirada.", code: "session_refresh_required" },
      401,
    );

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: staff } = await admin
    .from("staff_members")
    .select("role,active")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!staff?.active || !["owner", "manager"].includes(staff.role))
    return secureJson(
      { error: "Seu perfil não pode consultar a integração." },
      403,
    );

  const required = [
    ["META_WA_ACCESS_TOKEN", env("META_WA_ACCESS_TOKEN")],
    ["META_WA_PHONE_NUMBER_ID", env("META_WA_PHONE_NUMBER_ID")],
    ["META_WA_WABA_ID", env("META_WA_WABA_ID")],
    ["META_WA_APP_SECRET", env("META_WA_APP_SECRET")],
    ["META_WA_VERIFY_TOKEN", env("META_WA_VERIFY_TOKEN")],
    ["META_WA_AUTH_TEMPLATE_NAME", env("META_WA_AUTH_TEMPLATE_NAME")],
    ["WHATSAPP_OTP_PEPPER", env("WHATSAPP_OTP_PEPPER")],
  ] as const;
  const missing: string[] = required
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);
  const rawVersion = env("META_WA_GRAPH_API_VERSION") || "v23.0";
  let graphApiVersion = rawVersion;
  let graphVersionValid = true;
  try {
    graphApiVersion = normalizeMetaGraphVersion(rawVersion);
  } catch {
    graphVersionValid = false;
  }
  if (!graphVersionValid) missing.push("META_WA_GRAPH_API_VERSION");

  const configured = missing.length === 0;
  const rawUnitCost = Number(env("META_WA_AUTH_UNIT_COST_USD") || "0.00782");
  const unitCostUsd = Number.isFinite(rawUnitCost) && rawUnitCost >= 0
    ? rawUnitCost
    : 0.00782;

  return secureJson({
    configured,
    mode: configured ? "ready" : "incomplete",
    environment: env("CONTEXT") || env("DEPLOY_CONTEXT") || "unknown",
    missing,
    graphApiVersion,
    templateName: env("META_WA_AUTH_TEMPLATE_NAME") || null,
    phoneNumberId: suffix(env("META_WA_PHONE_NUMBER_ID")),
    wabaId: suffix(env("META_WA_WABA_ID")),
    webhookPath: "/api/whatsapp-cloud-webhook",
    unitCostUsd,
    provider: "Meta WhatsApp Cloud API",
    secretsExposed: false,
    checkedAt: new Date().toISOString(),
  });
};

export const config = { path: "/api/meta-whatsapp-health" };
