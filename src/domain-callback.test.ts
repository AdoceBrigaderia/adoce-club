import { beforeEach, expect, it, vi } from "vitest";
import twilio from "twilio";
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../netlify/functions/_shared/whatsapp-auth", () => ({
  env: (key: string) => key === "TWILIO_AUTH_TOKEN" ? "test-token" : "",
  json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status }),
  serviceClient: () => ({ rpc: state.rpc }),
}));
import callback from "../netlify/functions/customer-order-status";
beforeEach(() => state.rpc.mockReset().mockResolvedValue({ error: null }));

it.each(["https://www.adocebrigaderia.com.br", "https://www.cantinhodaadoce.com.br"])(
  "aceita callback assinado antes ou depois da migração: %s", async (origin) => {
    const url = `${origin}/api/twilio/customer-order-status?notice_id=1&attempt=1`;
    const form = { MessageSid: `SM${"a".repeat(32)}`, MessageStatus: "delivered" };
    const signature = twilio.getExpectedTwilioSignature("test-token", url, form);
    const response = await callback(new Request(url, { method: "POST", headers: { "x-twilio-signature": signature }, body: new URLSearchParams(form).toString() }));
    expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("server_customer_notice_callback", expect.objectContaining({ requested_status: "delivered", requested_attempt: 1 }));
  },
);

it("recusa assinatura emitida para um site externo", async () => {
  const path = "/api/twilio/customer-order-status?notice_id=1&attempt=1";
  const form = { MessageSid: `SM${"a".repeat(32)}`, MessageStatus: "delivered" };
  const signature = twilio.getExpectedTwilioSignature("test-token", `https://evil.example${path}`, form);
  const response = await callback(new Request(`https://www.cantinhodaadoce.com.br${path}`, { method: "POST", headers: { "x-twilio-signature": signature }, body: new URLSearchParams(form).toString() }));
  expect(response.status).toBe(401);
  expect(state.rpc).not.toHaveBeenCalled();
});
