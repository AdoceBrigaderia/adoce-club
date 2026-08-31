import twilio from "twilio";
import { env, json, serviceClient } from "./_shared/whatsapp-auth";

const MAX_BODY_BYTES = 16384;

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);

  const authToken = env("TWILIO_AUTH_TOKEN") || "";
  const configuredUrl = env("TWILIO_ORDER_NOTIFICATION_STATUS_URL") || "";
  const form = new URLSearchParams(rawBody);
  const params = Object.fromEntries(form.entries());
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!authToken || !configuredUrl || !signature || !twilio.validateRequest(authToken, signature, configuredUrl, params)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const messageSid = form.get("MessageSid") || "";
  const providerStatus = (form.get("MessageStatus") || "").toLowerCase();
  if (!/^[A-Za-z0-9]{8,80}$/.test(messageSid)) return json({ error: "Invalid message" }, 400);
  const status = ["delivered", "read"].includes(providerStatus)
    ? "delivered"
    : ["failed", "undelivered", "canceled"].includes(providerStatus)
      ? "failed"
      : "accepted";
  const providerError = status === "failed"
    ? `twilio_${String(form.get("ErrorCode") || providerStatus).slice(0, 40)}`
    : null;

  const admin = serviceClient();
  if (!admin) return json({ error: "Server not configured" }, 503);
  const { error } = await admin.rpc("server_update_order_staff_notification_status", {
    requested_message_sid: messageSid,
    requested_status: status,
    requested_error: providerError,
  });
  if (error) return json({ error: "Status update failed" }, 503);
  return json({ ok: true });
};

export const config = { path: "/api/twilio/order-notification-status", timeout: 10 };
