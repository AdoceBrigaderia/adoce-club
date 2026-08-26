import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260722172238_instant_orders_and_pickup.sql", import.meta.url),
  "utf8",
);
const publicPanel = readFileSync(new URL("./InstantOrderPanel.tsx", import.meta.url), "utf8");
const operationQueue = readFileSync(new URL("./OperationInstantOrders.tsx", import.meta.url), "utf8");
const manualEntry = readFileSync(new URL("./OperationManualSale.tsx", import.meta.url), "utf8");
const todayPage = readFileSync(new URL("./AdoceHoje.tsx", import.meta.url), "utf8");
const accessApp = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./operation-instant-orders-enhancements.css", import.meta.url), "utf8");

describe("fundação segura dos pedidos imediatos", () => {
  it("mantém o pagamento automático desligado e a regra preparada para quatro fatias", () => {
    expect(migration).toContain("automatic_checkout_enabled boolean not null default false");
    expect(migration).toContain("automatic_checkout_minimum integer not null default 4");
    expect(migration).toContain("for update");
    expect(migration).toContain("expire_instant_order_reservations");
  });

  it("protege tabelas e expõe somente funções públicas controladas", () => {
    expect(migration).toContain("alter table public.instant_orders enable row level security");
    expect(migration).toMatch(/revoke all on public\.pickup_locations, public\.instant_orders, public\.instant_order_items\s+from public, anon, authenticated/);
    expect(migration).toContain("grant execute on function public.submit_instant_order");
    expect(migration).toContain("grant execute on function public.staff_update_instant_order");
  });

  it("explica que a confirmação vem antes do pagamento", () => {
    expect(publicPanel).toContain("Nenhum pagamento será solicitado antes da confirmação da disponibilidade.");
    expect(publicPanel).not.toContain("Pague agora");
  });

  it("oferece fila operacional e abre a rota direta de vendas", () => {
    expect(operationQueue).toContain("Confirmar e enviar cobrança");
    expect(operationQueue).toContain("Iniciar separação e avisar");
    expect(operationQueue).toContain("Pedido pronto e avisar retirada");
    expect(operationQueue).toContain("Pagamento recebido: iniciar separação e avisar");
    expect(operationQueue).toContain("Confirmamos a disponibilidade e reservamos as fatias");
    expect(operationQueue).toContain("instant-order-status-track");
    expect(styles).toContain("grid-template-columns: repeat(5, minmax(0, 1fr))");
    expect(styles).toContain("overflow: visible");
    expect(operationQueue).toContain("Marcar como entregue");
    expect(accessApp).toContain('location.hash.includes("vendas")');
  });

  it("registra pedidos recebidos no WhatsApp antes de tratá-los como venda concluída", () => {
    expect(manualEntry).toContain("Registrar pedido recebido no WhatsApp");
    expect(manualEntry).toContain('mode === "order"');
    expect(manualEntry).toContain('rpc("staff_submit_instant_order_v5"');
    expect(manualEntry).toContain("entrou na fila para conferência");
    expect(manualEntry).toContain("Mensagens recebidas diretamente no WhatsApp não entram sozinhas na fila");
  });

  it("baixa venda manual pelo caixa ou pela fila de conciliacao, nunca pela funcao aposentada", () => {
    expect(manualEntry).toContain('rpc("staff_create_manual_sale_in_cash_v2"');
    expect(manualEntry).toContain('rpc("manager_create_manual_sale_for_reconciliation"');
    expect(manualEntry).toContain('rpc("staff_open_cash_session"');
    expect(manualEntry).not.toContain('rpc("staff_create_manual_sale",');
    expect(manualEntry).toContain("Baixar venda e enviar para conciliação");
  });

  it("faz os botões de pedido do Adoce Hoje registrarem a solicitação antes do WhatsApp", () => {
    expect(todayPage).toContain("Montar pedido para retirada");
    expect(todayPage).toContain('onClick={() => openInstantOrder()}');
    expect(todayPage).toContain("Pedir para retirar");
  });
});
