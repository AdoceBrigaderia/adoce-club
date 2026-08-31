import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import orderWebhook from "../netlify/functions/order-notification-webhook";
import statusWebhook from "../netlify/functions/order-notification-status";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("avisos obrigatórios de novos pedidos", () => {
  it("cria e acompanha uma entrega independente para Rubens e Beth", () => {
    const migration = source("../supabase/migrations/20260831000431_reliable_order_staff_notifications.sql");
    expect(migration).toContain("values (new.id, 'rubens'), (new.id, 'beth')");
    expect(migration).toContain("primary key (order_id, recipient_key)");
    expect(migration).toContain("private.order_staff_notification_deliveries");
    expect(migration).toContain("net.http_post");
    expect(migration).toContain("new.sales_channel");
    expect(migration).toContain("= 'operation'");
    expect(migration).not.toContain("new.created_by is not null");
    expect(migration).not.toContain("/#operacao");
  });

  it("envia número, nome do cliente e o link operacional solicitado", () => {
    const endpoint = source("../netlify/functions/order-notification-webhook.ts");
    expect(endpoint).toContain("TWILIO_FESTIVAL_STAFF_TO");
    expect(endpoint).toContain("TWILIO_QUOTE_STAFF_TO");
    expect(endpoint).toContain('"1": order.order_number');
    expect(endpoint).toContain('"2": order.customer_name');
    expect(endpoint).toContain("https://www.adocebrigaderia.com.br/operacao/pedidos?tipo=vendas");
    expect(endpoint).toContain("server_complete_order_staff_notification");
    expect(endpoint).not.toContain("console.log(order");
    expect(endpoint).not.toContain("console.log(destination");
  });

  it("rejeita chamadas sem o segredo interno antes de acessar o banco", async () => {
    const previous = process.env.ORDER_NOTIFICATION_WEBHOOK_SECRET;
    process.env.ORDER_NOTIFICATION_WEBHOOK_SECRET = "segredo-de-teste-comprido";
    try {
      const response = await orderWebhook(new Request("https://example.com/api/hooks/orders/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "instant_order.created", order_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
      }));
      expect(response.status).toBe(401);
    } finally {
      if (previous === undefined) delete process.env.ORDER_NOTIFICATION_WEBHOOK_SECRET;
      else process.env.ORDER_NOTIFICATION_WEBHOOK_SECRET = previous;
    }
  });

  it("valida a assinatura Twilio nas confirmações de entrega", async () => {
    const previousToken = process.env.TWILIO_AUTH_TOKEN;
    const previousUrl = process.env.TWILIO_ORDER_NOTIFICATION_STATUS_URL;
    process.env.TWILIO_AUTH_TOKEN = "token-de-teste";
    process.env.TWILIO_ORDER_NOTIFICATION_STATUS_URL = "https://example.com/api/twilio/order-notification-status";
    try {
      const response = await statusWebhook(new Request(process.env.TWILIO_ORDER_NOTIFICATION_STATUS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ MessageSid: "SM12345678901234567890123456789012", MessageStatus: "delivered" }),
      }));
      expect(response.status).toBe(401);
    } finally {
      if (previousToken === undefined) delete process.env.TWILIO_AUTH_TOKEN; else process.env.TWILIO_AUTH_TOKEN = previousToken;
      if (previousUrl === undefined) delete process.env.TWILIO_ORDER_NOTIFICATION_STATUS_URL; else process.env.TWILIO_ORDER_NOTIFICATION_STATUS_URL = previousUrl;
    }
  });
});
