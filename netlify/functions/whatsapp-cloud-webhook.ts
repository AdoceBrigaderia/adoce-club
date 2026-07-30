import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  extractMetaMessageStatuses,
  verifyMetaWebhookSignature,
} from "./_shared/meta-whatsapp";
import { secureText } from "./_shared/response-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

function equalSecret(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export default async (request: Request) => {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode") || "";
    const suppliedToken = url.searchParams.get("hub.verify_token") || "";
    const challenge = url.searchParams.get("hub.challenge") || "";
    const expectedToken = env("META_WA_VERIFY_TOKEN") || "";
    if (
      mode === "subscribe" &&
      challenge &&
      expectedToken &&
      equalSecret(suppliedToken, expectedToken)
    ) {
      return secureText(challenge);
    }
    return secureText("Webhook não autorizado.", 401);
  }

  if (request.method !== "POST")
    return secureText("Método não permitido.", 405);
  const rawBody = await request.text();
  const appSecret = env("META_WA_APP_SECRET") || "";
  if (
    !verifyMetaWebhookSignature(
      rawBody,
      request.headers.get("x-hub-signature-256"),
      appSecret,
    )
  ) {
    return secureText("Assinatura inválida.", 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return secureText("Payload inválido.", 400);
  }

  const statuses = extractMetaMessageStatuses(payload);
  if (!statuses.length) return secureText("EVENT_RECEIVED");

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const secretKey =
    env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secretKey)
    return secureText("Backend indisponível.", 503);
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const status of statuses) {
    const timestamp = status.timestamp
      ? new Date(Number(status.timestamp) * 1000).toISOString()
      : new Date().toISOString();
    const { error } = await admin.rpc(
      "server_update_whatsapp_auth_delivery",
      {
        requested_provider_message_id: status.messageId,
        requested_status: status.status,
        provider_timestamp: timestamp,
        error_code: status.errorCode,
        error_title: status.errorTitle,
      },
    );
    if (error) return secureText("Falha ao registrar evento.", 500);
  }

  return secureText("EVENT_RECEIVED");
};

export const config = { path: "/api/whatsapp-cloud-webhook" };
