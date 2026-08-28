declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

export const metaEnv = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const encoder = new TextEncoder();

const toHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function validMetaSignature(rawBody: string, signature: string, appSecret: string) {
  if (!appSecret || !signature.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = `sha256=${toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody)))}`;
  if (signature.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < signature.length; index += 1)
    difference |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

export type MetaIngressEvent = {
  accountId: string;
  externalEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

type MetaEntry = {
  id?: string;
  time?: number;
  messaging?: Array<Record<string, unknown>>;
  changes?: Array<{ field?: string; value?: Record<string, unknown> }>;
};

const nestedString = (value: unknown, key: string) => {
  if (!value || typeof value !== "object") return "";
  const nested = (value as Record<string, unknown>)[key];
  return typeof nested === "string" ? nested : "";
};

async function stableFallbackId(accountId: string, type: string, timestamp: number, payload: unknown) {
  return `fallback:${await sha256(`${accountId}:${type}:${timestamp}:${JSON.stringify(payload)}`)}`;
}

export async function extractInstagramEvents(payload: unknown): Promise<MetaIngressEvent[]> {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { object?: string; entry?: MetaEntry[] };
  if (root.object !== "instagram" || !Array.isArray(root.entry)) return [];

  const events: MetaIngressEvent[] = [];
  for (const entry of root.entry.slice(0, 100)) {
    const accountId = typeof entry.id === "string" ? entry.id : "";
    if (!accountId) continue;
    const timestamp = Number(entry.time || 0);

    for (const messaging of (entry.messaging || []).slice(0, 100)) {
      const message = messaging.message;
      const postback = messaging.postback;
      const reaction = messaging.reaction;
      const eventType = message ? "message" : postback ? "postback" : reaction ? "reaction" : "messaging";
      const externalId =
        nestedString(message, "mid") ||
        nestedString(postback, "mid") ||
        nestedString(reaction, "mid") ||
        await stableFallbackId(accountId, eventType, Number(messaging.timestamp || timestamp), messaging);
      events.push({ accountId, externalEventId: externalId, eventType, payload: messaging });
    }

    for (const change of (entry.changes || []).slice(0, 100)) {
      const eventType = `change.${change.field || "unknown"}`;
      const externalId =
        nestedString(change.value, "id") ||
        nestedString(change.value, "comment_id") ||
        await stableFallbackId(accountId, eventType, timestamp, change);
      events.push({ accountId, externalEventId: externalId, eventType, payload: change as Record<string, unknown> });
    }
  }
  return events.slice(0, 100);
}

export const metaTextResponse = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
