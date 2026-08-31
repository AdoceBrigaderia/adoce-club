import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import orderWebhook from "../netlify/functions/twilio-whatsapp-order";
import {
  isFullName,
  parseItemSelection,
  parsePickupTime,
  twiml,
} from "../netlify/functions/_shared/whatsapp-order-bot";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const flavors = [
  { id: "a", name: "Brigadeiro", price: 16, free: 5 },
  { id: "b", name: "Ninho", price: 18, free: 2 },
];

describe("pedido automatizado pelo WhatsApp", () => {
  it("interpreta itens, soma repetiÃ§Ãµes e respeita o estoque", () => {
    expect(parseItemSelection("1x2, 2", flavors)).toMatchObject({
      selections: [
        { id: "a", quantity: 2 },
        { id: "b", quantity: 1 },
      ],
    });
    expect(parseItemSelection("2x3", flavors)).toMatchObject({
      error: expect.stringContaining("2 unidade"),
    });
    expect(parseItemSelection("99x1", flavors)).toMatchObject({
      error: expect.stringContaining("99"),
    });
  });

  it("exige nome completo e horÃ¡rio futuro", () => {
    expect(isFullName("Maria da Silva")).toBe(true);
    expect(isFullName("Maria")).toBe(false);
    expect(parsePickupTime("19:30", "18:00")).toBe("19:30");
    expect(parsePickupTime("17:59", "18:00")).toBeNull();
    expect(parsePickupTime("25:00", "18:00")).toBeNull();
  });

  it("escapa a resposta TwiML e nÃ£o permite injetar XML", () => {
    const xml = twiml("<pedido> & confirmaÃ§Ã£o");
    expect(xml).toContain("&lt;pedido&gt; &amp; confirmaÃ§Ã£o");
    expect(xml).not.toContain("<pedido>");
  });

  it("falha fechada quando a automaÃ§Ã£o estÃ¡ desligada", async () => {
    const previous = process.env.WHATSAPP_ORDER_BOT_ENABLED;
    process.env.WHATSAPP_ORDER_BOT_ENABLED = "false";
    try {
      const response = await orderWebhook(new Request("https://example.com/api/twilio/whatsapp/order", {
        method: "POST",
      }));
      expect(response.status).toBe(503);
    } finally {
      if (previous === undefined) delete process.env.WHATSAPP_ORDER_BOT_ENABLED;
      else process.env.WHATSAPP_ORDER_BOT_ENABLED = previous;
    }
  });

  it("rejeita webhook sem assinatura Twilio antes de consultar o banco", async () => {
    const previous = {
      enabled: process.env.WHATSAPP_ORDER_BOT_ENABLED,
      token: process.env.TWILIO_AUTH_TOKEN,
      url: process.env.TWILIO_WHATSAPP_ORDER_WEBHOOK_URL,
      from: process.env.TWILIO_WHATSAPP_FROM,
      hmac: process.env.AUTH_RATE_LIMIT_HMAC_SECRET,
    };
    process.env.WHATSAPP_ORDER_BOT_ENABLED = "true";
    process.env.TWILIO_AUTH_TOKEN = "token-de-teste";
    process.env.TWILIO_WHATSAPP_ORDER_WEBHOOK_URL = "https://example.com/api/twilio/whatsapp/order";
    process.env.TWILIO_WHATSAPP_FROM = "+5585999999999";
    process.env.AUTH_RATE_LIMIT_HMAC_SECRET = "hmac-de-teste";
    try {
      const response = await orderWebhook(new Request(process.env.TWILIO_WHATSAPP_ORDER_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          From: "whatsapp:+5585999991234",
          To: "whatsapp:+5585999999999",
          MessageSid: "SM12345678901234567890123456789012",
          Body: "pedido",
        }),
      }));
      expect(response.status).toBe(401);
    } finally {
      if (previous.enabled === undefined) delete process.env.WHATSAPP_ORDER_BOT_ENABLED; else process.env.WHATSAPP_ORDER_BOT_ENABLED = previous.enabled;
      if (previous.token === undefined) delete process.env.TWILIO_AUTH_TOKEN; else process.env.TWILIO_AUTH_TOKEN = previous.token;
      if (previous.url === undefined) delete process.env.TWILIO_WHATSAPP_ORDER_WEBHOOK_URL; else process.env.TWILIO_WHATSAPP_ORDER_WEBHOOK_URL = previous.url;
      if (previous.from === undefined) delete process.env.TWILIO_WHATSAPP_FROM; else process.env.TWILIO_WHATSAPP_FROM = previous.from;
      if (previous.hmac === undefined) delete process.env.AUTH_RATE_LIMIT_HMAC_SECRET; else process.env.AUTH_RATE_LIMIT_HMAC_SECRET = previous.hmac;
    }
  });

  it("mantÃ©m estado e deduplicaÃ§Ã£o em tabelas privadas", () => {
    const migration = source("../supabase/migrations/20260830104000_whatsapp_order_bot_foundation.sql");
    const endpoint = source("../netlify/functions/twilio-whatsapp-order.ts");
    expect(migration).toContain("private.whatsapp_order_conversations");
    expect(migration).toContain("private.whatsapp_order_messages");
    expect(migration).toContain("server_submit_whatsapp_order");
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon, authenticated/);
    expect(endpoint).toContain("twilio.validateRequest");
    expect(endpoint).toContain("server_begin_whatsapp_order_message");
    expect(endpoint).toContain("server_submit_whatsapp_order");
    expect(endpoint).not.toContain("console.log(body");
    expect(endpoint).not.toContain("console.log(phone");
  });
});
