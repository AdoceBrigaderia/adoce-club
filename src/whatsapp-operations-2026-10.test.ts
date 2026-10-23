import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("pedidos online e WhatsApp operacional", () => {
  const migration = read("../supabase/migrations/20261016142747_online_orders_whatsapp_operations.sql");
  const inbox = read("./WhatsAppSupportInbox.tsx");
  const api = read("../netlify/functions/whatsapp-support.ts");
  const bot = read("../netlify/functions/twilio-whatsapp-order.ts");

  it("libera a reserva sem expirar o pedido que aguarda comprovante", () => {
    expect(migration).toContain("instant_order.inventory_reservation_released");
    expect(migration).toContain("'order_preserved',true");
    expect(migration).not.toMatch(/target\.status='awaiting_payment'[\s\S]{0,500}status='expired'/);
  });

  it("carrega conversas e mensagens em paginas limitadas", () => {
    expect(api).toContain("server_list_whatsapp_support_threads_page");
    expect(api).toContain("server_get_whatsapp_support_thread_page");
    expect(inbox).toContain("Carregar conversas anteriores");
    expect(inbox).toContain("Carregar mensagens anteriores");
  });

  it("ordena por atividade e permite arquivamento logico em lote", () => {
    expect(inbox).toContain("selectedThreadIds");
    expect(inbox).toContain("Selecionar todas desta página");
    expect(inbox).toContain("Encerrar selecionadas");
    expect(api).toContain("server_archive_whatsapp_support_threads");
  });

  it("consulta pedidos do dia antes de iniciar outra compra", () => {
    expect(bot).toContain("server_find_whatsapp_orders_today");
    expect(bot).toContain('conversation.step === "existing_order_choice"');
    expect(bot).toContain("falar sobre esse pedido ou fazer uma nova compra");
  });
});
