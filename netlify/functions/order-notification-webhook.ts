import twilio from "twilio";
import { env, json, serviceClient } from "./_shared/whatsapp-auth";

type ClaimedRecipient = { recipient_key: "rubens" | "beth"; attempt: number };
type Order = { id: string; order_number: string; customer_name: string };

const MAX_BODY_BYTES = 8192;
const ORDER_LINK = "https://www.adocebrigaderia.com.br/operacao/pedidos?tipo=vendas";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const constantTimeTextEqual = (left: string, right: string) => {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const size = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < size; index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
};

const whatsappAddress = (value: string) => value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;

const retryableTwilioError = (error: unknown) => {
  const status = Number((error as { status?: number })?.status || 0);
  return status === 429 || status >= 500;
};

const safeError = (error: unknown) => {
  const status = Number((error as { status?: number })?.status || 0);
  const code = String((error as { code?: string | number })?.code || "unknown").slice(0, 40);
  return `twilio_${status || "error"}_${code}`;
};

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);

  const configuredSecret = env("ORDER_NOTIFICATION_WEBHOOK_SECRET") || "";
  const suppliedSecret = request.headers.get("x-adoce-webhook-secret") || "";
  if (!configuredSecret || !suppliedSecret || !constantTimeTextEqual(configuredSecret, suppliedSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
  const payload = (() => {
    try { return JSON.parse(rawBody || "{}"); }
    catch { return null; }
  })();
  const orderId = String(payload?.order_id || "");
  if (payload?.event !== "instant_order.created" || !UUID.test(orderId)) {
    return json({ error: "Invalid event" }, 400);
  }

  const admin = serviceClient();
  if (!admin) return json({ error: "Server not configured" }, 503);
  const { data: orderData, error: orderError } = await admin
    .from("instant_orders")
    .select("id,order_number,customer_name")
    .eq("id", orderId)
    .single();
  if (orderError || !orderData) return json({ error: "Order not found" }, 404);

  const { data: claimedData, error: claimError } = await admin.rpc("server_claim_order_staff_notifications", {
    requested_order_id: orderId,
  });
  if (claimError) return json({ error: "Delivery claim failed" }, 503);
  const claimed = (claimedData || []) as ClaimedRecipient[];
  if (!claimed.length) return json({ ok: true, deliveries: 0 });

  const accountSid = env("TWILIO_ACCOUNT_SID") || "";
  const authToken = env("TWILIO_AUTH_TOKEN") || "";
  const official = env("TWILIO_WHATSAPP_FROM") || "";
  const contentSid = env("TWILIO_ORDER_NOTIFICATION_CONTENT_SID") || "";
  const statusCallback = env("TWILIO_ORDER_NOTIFICATION_STATUS_URL") || "";
  const destinations = {
    rubens: env("TWILIO_FESTIVAL_STAFF_TO") || "",
    beth: env("TWILIO_QUOTE_STAFF_TO") || "",
  };
  const configured = accountSid && authToken && official && contentSid && statusCallback;
  const client = configured ? twilio(accountSid, authToken) : null;
  const order = orderData as Order;

  const results = await Promise.all(claimed.map(async (delivery) => {
    const destination = destinations[delivery.recipient_key];
    if (!client || !destination) {
      await admin.rpc("server_complete_order_staff_notification", {
        requested_order_id: order.id,
        requested_recipient_key: delivery.recipient_key,
        requested_status: "failed",
        requested_error: "notification_configuration_missing",
      });
      return { recipient: delivery.recipient_key, status: "failed" };
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const sent = await client.messages.create({
          from: whatsappAddress(official),
          to: whatsappAddress(destination),
          contentSid,
          contentVariables: JSON.stringify({
            "1": order.order_number.slice(0, 80),
            "2": order.customer_name.slice(0, 120),
            "3": ORDER_LINK,
          }),
          statusCallback,
        });
        const { error } = await admin.rpc("server_complete_order_staff_notification", {
          requested_order_id: order.id,
          requested_recipient_key: delivery.recipient_key,
          requested_status: "accepted",
          requested_message_sid: sent.sid,
        });
        if (error) throw new Error(`delivery_store_${error.code}`);
        return { recipient: delivery.recipient_key, status: "accepted" };
      } catch (error) {
        lastError = error;
        if (!retryableTwilioError(error) || attempt === 3) break;
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
    await admin.rpc("server_complete_order_staff_notification", {
      requested_order_id: order.id,
      requested_recipient_key: delivery.recipient_key,
      requested_status: "failed",
      requested_error: safeError(lastError),
    });
    return { recipient: delivery.recipient_key, status: "failed" };
  }));

  const failed = results.filter((result) => result.status === "failed").length;
  return json({ ok: failed === 0, deliveries: results.length, failed }, failed ? 502 : 200);
};

export const config = { path: "/api/hooks/orders/notify", timeout: 20 };
