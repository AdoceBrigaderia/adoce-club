import { createClient } from "@supabase/supabase-js";
import {
  extractInstagramEvents,
  metaEnv,
  metaTextResponse,
  sha256,
  validMetaSignature,
} from "./_meta-webhook";

const MAX_BODY_BYTES = 512 * 1024;

export default async (request: Request) => {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") || "";
    const verifyToken = metaEnv("META_INSTAGRAM_VERIFY_TOKEN") || metaEnv("META_WEBHOOK_VERIFY_TOKEN");
    if (mode === "subscribe" && verifyToken && token === verifyToken)
      return metaTextResponse(challenge);
    return metaTextResponse("Webhook não autorizado.", 403);
  }

  if (request.method !== "POST") return metaTextResponse("Método não permitido.", 405);
  if (metaEnv("INSTAGRAM_INTEGRATION_ENABLED") !== "true")
    return metaTextResponse("EVENT_IGNORED_DISABLED");

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return metaTextResponse("Payload excede o limite.", 413);

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES)
    return metaTextResponse("Payload excede o limite.", 413);

  const signature = request.headers.get("x-hub-signature-256") || "";
  const appSecret = metaEnv("META_INSTAGRAM_APP_SECRET") || metaEnv("META_APP_SECRET") || "";
  if (!(await validMetaSignature(rawBody, signature, appSecret)))
    return metaTextResponse("Assinatura inválida.", 401);

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return metaTextResponse("JSON inválido.", 400);
  }

  const events = await extractInstagramEvents(payload);
  if (events.length === 0) return metaTextResponse("EVENT_IGNORED");

  const expectedAccountId = metaEnv("META_INSTAGRAM_ACCOUNT_ID") || "";
  if (!expectedAccountId || events.some((event) => event.accountId !== expectedAccountId))
    return metaTextResponse("Conta do evento não autorizada.", 403);

  const supabaseUrl = metaEnv("SUPABASE_URL") || "";
  const secretKey = metaEnv("SUPABASE_SECRET_KEY") || metaEnv("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !secretKey) return metaTextResponse("Servidor não configurado.", 503);

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const environment = metaEnv("META_ENVIRONMENT") || "development";

  const { data: account, error: accountError } = await supabase
    .from("channel_accounts")
    .upsert({
      channel: "instagram",
      external_account_id: expectedAccountId,
      environment,
      active: true,
      last_event_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "channel,external_account_id,environment" })
    .select("id")
    .single();

  if (accountError || !account) {
    console.error("Instagram ingress account persistence failed", accountError?.code || "unknown");
    return metaTextResponse("Falha temporária ao registrar evento.", 503);
  }

  const rows = await Promise.all(events.map(async (event) => ({
    channel_account_id: account.id,
    channel: "instagram",
    external_event_id: event.externalEventId,
    event_type: event.eventType,
    payload: event.payload,
    payload_sha256: await sha256(JSON.stringify(event.payload)),
    status: "pending",
  })));

  const { error: ingressError } = await supabase
    .from("channel_external_events")
    .upsert(rows, { onConflict: "channel,external_event_id", ignoreDuplicates: true });

  if (ingressError) {
    console.error("Instagram ingress persistence failed", ingressError.code || "unknown");
    return metaTextResponse("Falha temporária ao registrar evento.", 503);
  }

  return metaTextResponse("EVENT_RECEIVED");
};

export const config = { path: "/api/meta-instagram-webhook" };
