import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import orderWebhook from "../netlify/functions/twilio-whatsapp-order";
import {
  catalogMessage,
  driverAddressMessage,
  isFullName,
  mainMenuMessage,
  MAX_SLICES_PER_FLAVOR,
  orderSummary,
  parseItemSelection,
  parsePickupTime,
  PICKUP_CLOSING,
  pickupTimeOptions,
  pixMessage,
  quantityMessage,
  removeItemMessage,
  sauceModeMessage,
  sliceSauceMessage,
  twiml,
} from "../netlify/functions/_shared/whatsapp-order-bot";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const flavors = [
  { id: "a", name: "Brigadeiro", price: 16, free: 5 },
  { id: "b", name: "Ninho", price: 18, free: 2 },
];

describe("pedido automatizado pelo WhatsApp", () => {
  it("mantém a sintaxe antiga apenas como compatibilidade", () => {
    expect(parseItemSelection("1x2, 2", flavors)).toMatchObject({
      selections: [
        { id: "a", quantity: 2 },
        { id: "b", quantity: 1 },
      ],
    });
    expect(parseItemSelection("2x3", flavors)).toMatchObject({
      error: expect.stringContaining("2 unidade"),
    });
  });

  it("saúda com cardápio e atendimento escolhidos somente por número", () => {
    const greeting = mainMenuMessage();
    expect(greeting).toContain("1. Ver o cardápio do Festival de Fatias e fazer pedido");
    expect(greeting).toContain("2. Falar com a equipe sobre o Festival de Fatias");
    expect(greeting).toContain("3. Realizar orçamento");
    expect(greeting).toContain("responda com o número da opção desejada");
    expect(greeting).not.toMatch(/digite\s+menu/i);
  });

  it("oferece sabor, quantidade e conclusão como opções numeradas", () => {
    const catalog = catalogMessage(flavors, [{ ...flavors[0], quantity: 2 }]);
    const quantities = quantityMessage(flavors[1], 2);
    expect(catalog).toContain("1. Brigadeiro");
    expect(catalog).toContain("3. Concluir a escolha e continuar");
    expect(catalog).toContain("2x Brigadeiro");
    expect(quantities).toContain("1. 1 fatia");
    expect(quantities).toContain("2. 2 fatias");
    expect(quantities).toContain("3. Voltar aos sabores");
  });

  it("gera horários futuros de meia em meia hora para escolha numérica", () => {
    expect(pickupTimeOptions("18:10", 4)).toEqual(["18:30", "19:00", "19:30", "20:00"]);
    expect(pickupTimeOptions("23:31")).toEqual([]);
    expect(parsePickupTime("19:30", "18:00")).toBe("19:30");
  });

  it("limita a janela de retirada ao horário de fechamento do Cantinho", () => {
    expect(PICKUP_CLOSING).toBe("23:00");
    expect(pickupTimeOptions("20:00")).toEqual([
      "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00",
    ]);
    expect(pickupTimeOptions("22:40")).toEqual(["23:00"]);
    expect(pickupTimeOptions("23:10")).toEqual([]);
  });

  it("mostra subtotal e opção de remover item ao montar o pedido", () => {
    const catalog = catalogMessage(flavors, [
      { ...flavors[0], quantity: 2 },
      { ...flavors[1], quantity: 1 },
    ]);
    expect(catalog).toMatch(/• 2x Brigadeiro — R\$\s?32,00/);
    expect(catalog).toMatch(/Subtotal: R\$\s?50,00/);
    expect(catalog).toContain("6. Remover um item do pedido");
    expect(catalogMessage(flavors, [])).not.toContain("Remover um item");
  });

  it("teto de fatias é por sabor e avisa quando o estoque limita", () => {
    expect(MAX_SLICES_PER_FLAVOR).toBe(13);
    expect(quantityMessage(flavors[0], 13)).not.toContain("Máximo disponível");
    expect(quantityMessage(flavors[1], 2)).toContain("Máximo disponível agora: 2 fatias deste sabor.");
    expect(removeItemMessage([{ ...flavors[0], quantity: 3 }])).toContain("1. 3x Brigadeiro");
  });

  it("marca sabor sem estoque como esgotado no cardápio", () => {
    const catalog = catalogMessage([flavors[0], { ...flavors[1], free: 0 }]);
    expect(catalog).toMatch(/1\. Brigadeiro — R\$\s?16,00 \(5 disponíveis\)/);
    expect(catalog).toContain("2. Ninho — esgotado");
    expect(catalog).not.toMatch(/Ninho — R\$/);
  });

  it("só persiste passos aceitos pela função server_save_whatsapp_order_conversation", () => {
    const endpoint = source("../netlify/functions/twilio-whatsapp-order.ts");
    const foundation = source("../supabase/migrations/20260830104000_whatsapp_order_bot_foundation.sql");
    const allowBlock = foundation.match(/requested_step not in \(([\s\S]*?)\)/);
    expect(allowBlock).toBeTruthy();
    const allowed = new Set(
      Array.from(allowBlock![1].matchAll(/'([a-z_]+)'/g), (match) => match[1]),
    );
    const savedSteps = new Set(
      Array.from(endpoint.matchAll(/\bsave\(\s*"([a-z_]+)"/g), (match) => match[1]),
    );
    for (const step of savedSteps) {
      expect(allowed.has(step), `passo "${step}" não está na allowlist do banco`).toBe(true);
    }
  });

  it("guarda apenas a janela de 30 min para pedido em andamento", () => {
    const endpoint = source("../netlify/functions/twilio-whatsapp-order.ts");
    expect(endpoint).toContain("CONVERSATION_TTL_MINUTES = 30");
    expect(endpoint).not.toContain("CONVERSATION_TTL_HOURS");
  });

  it("relê o catálogo em vez de usar o estoque em cache do estado", () => {
    const endpoint = source("../netlify/functions/twilio-whatsapp-order.ts");
    // o estado não guarda mais a lista de sabores com quantidade
    expect(endpoint).not.toMatch(/\bstate\.flavors\b/);
    // choose_items recarrega o catálogo a cada mensagem
    expect(endpoint).toMatch(/conversation\.step === "choose_items"[\s\S]{0,200}loadCatalog\(\)/);
  });

  it("oferece calda por fatia com atalho e traz os dados de Pix e retirada por entregador", () => {
    expect(sauceModeMessage(6)).toContain("mesma calda para todas as 6 fatias");
    expect(sauceModeMessage(6)).toContain("2. Quero escolher a calda de cada fatia");
    expect(sliceSauceMessage(2, 5, "Brigadeiro", [{ code: "c", label: "Chocolate" }]))
      .toContain("Calda da fatia 2 de 5 — *Brigadeiro*");
    expect(pixMessage()).toContain("pagamento@adocebrigaderia.com.br");
    expect(pixMessage()).toContain("Elizabeth Cristina Sampaio Nascimento");
    expect(pixMessage()).toContain("Mercado Pago");
    expect(driverAddressMessage("Maria")).toContain("Cantinho da Adoce");
    expect(driverAddressMessage("Maria")).toContain("Rua Cento Quatro, 277 – Passaré");
    expect(driverAddressMessage("Maria")).toContain("em nome de *Maria*");
  });

  it("confirma ou altera o pedido por números", () => {
    const summary = orderSummary({
      name: "Maria da Silva",
      selections: [{ ...flavors[0], quantity: 1 }],
      sauceLabel: "Chocolate",
      paymentLabel: "Pix",
      pickupMethod: "customer",
      pickupTime: "19:30",
    });
    expect(summary).toContain("1. Registrar pedido");
    expect(summary).toContain("2. Escolher outro horário");
    expect(summary).toContain("3. Cancelar pedido");
  });

  it("exige nome completo como único dado textual livre", () => {
    expect(isFullName("Maria da Silva")).toBe(true);
    expect(isFullName("Maria")).toBe(false);
  });

  it("escapa a resposta TwiML e não permite injetar XML", () => {
    const xml = twiml("<pedido> & confirmação");
    expect(xml).toContain("&lt;pedido&gt; &amp; confirmação");
    expect(xml).not.toContain("<pedido>");
  });

  it("falha fechada quando a automação está desligada", async () => {
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
          Body: "1",
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

  it("mantém estado e deduplicação em tabelas privadas", () => {
    const migration = source("../supabase/migrations/20260830104000_whatsapp_order_bot_foundation.sql");
    const endpoint = source("../netlify/functions/twilio-whatsapp-order.ts");
    expect(migration).toContain("private.whatsapp_order_conversations");
    expect(migration).toContain("private.whatsapp_order_messages");
    expect(migration).toContain("server_submit_whatsapp_order");
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon, authenticated/);
    expect(endpoint).toContain("twilio.validateRequest");
    expect(endpoint).toContain("server_prepare_whatsapp_order_message");
    expect(endpoint).toContain("server_finish_whatsapp_order_message");
    expect(endpoint).toContain("data: supportThreadId");
    expect(endpoint).toMatch(/if \(!supportThreadId\) \{[\s\S]*?return await showMainMenu\(\);/);
    expect(endpoint).not.toContain("server_begin_whatsapp_order_message");
    expect(endpoint).toContain("server_submit_whatsapp_order");
    expect(endpoint).not.toContain("console.log(body");
    expect(endpoint).not.toContain("console.log(phone");
  });
});
