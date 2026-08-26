import { createClient } from "@supabase/supabase-js";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const response = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });

const toHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

async function validMetaSignature(rawBody: string, signature: string, appSecret: string) {
  if (!signature.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = `sha256=${toHex(digest)}`;
  if (signature.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < signature.length; index += 1)
    difference |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

type MetaPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{ from?: string; text?: { body?: string } }>;
      };
    }>;
  }>;
};

export default async (request: Request) => {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") || "";
    if (mode === "subscribe" && token && token === env("META_WHATSAPP_VERIFY_TOKEN"))
      return response(challenge);
    return response("Webhook não autorizado.", 403);
  }
  if (request.method !== "POST") return response("Método não permitido.", 405);

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") || "";
  const appSecret = env("META_WHATSAPP_APP_SECRET") || "";
  if (!appSecret || !(await validMetaSignature(rawBody, signature, appSecret)))
    return response("Assinatura inválida.", 401);

  const supabaseUrl = env("SUPABASE_URL") || "";
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !secretKey) return response("Servidor não configurado.", 503);

  const payload = JSON.parse(rawBody) as MetaPayload;
  const messages =
    payload.entry?.flatMap((entry) =>
      entry.changes?.flatMap((change) => change.value?.messages || []) || [],
    ) || [];
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const message of messages) {
    const code = message.text?.body?.match(/\b(\d{6})\b/)?.[1];
    if (!message.from || !code) continue;
    const { error } = await supabase.rpc("confirm_whatsapp_verification", {
      sender_phone: message.from,
      received_code: code,
    });
    if (error) console.error("WhatsApp verification failed", error.message);
  }
  return response("EVENT_RECEIVED");
};

export const config = { path: "/api/meta-whatsapp-webhook" };
