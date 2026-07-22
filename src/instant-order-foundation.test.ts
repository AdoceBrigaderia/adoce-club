import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260722172238_instant_orders_and_pickup.sql", import.meta.url),
  "utf8",
);
const publicPanel = readFileSync(new URL("./InstantOrderPanel.tsx", import.meta.url), "utf8");
const operationQueue = readFileSync(new URL("./OperationInstantOrders.tsx", import.meta.url), "utf8");
const accessApp = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");

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
    expect(operationQueue).toContain("Marcar como entregue");
    expect(accessApp).toContain('location.hash.includes("vendas")');
  });
});
