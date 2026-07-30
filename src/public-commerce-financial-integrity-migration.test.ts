import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727015050_public_commerce_financial_integrity.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("integridade financeira dos pedidos públicos", () => {
  it("recalcula preços, quantidades e estoque exclusivamente no banco", () => {
    expect(migration).toContain("public_quote_instant_order");
    expect(migration).toContain("flavor.base_price");
    expect(migration).toContain("flavor_availability");
    expect(migration).toContain("quantity_available - coalesce");
    expect(migration).toContain("server_calculated");
  });

  it("impede métodos de pagamento internos no checkout público", () => {
    expect(migration).toContain("method.customer_selectable");
    expect(migration).toContain("Escolha uma forma de pagamento disponível para pedidos on-line");
  });

  it("calcula a diferença da recompensa usando o preço padrão do banco", () => {
    expect(migration).toContain("private.current_standard_slice_price()");
    expect(migration).toContain("reward_flavor.base_price - standard_price");
    expect(migration).not.toContain("reward_flavor.base_price - 16");
  });

  it("retorna valores financeiros oficiais depois do snapshot do pagamento", () => {
    expect(migration).toContain("private.snapshot_instant_order_payment");
    expect(migration).toContain("created_order.gross_amount");
    expect(migration).toContain("created_order.payment_fee_amount");
    expect(migration).toContain("created_order.net_amount");
  });

  it("mantém a cotação e o envio disponíveis apenas pelos papéis necessários", () => {
    expect(migration).toContain(
      "revoke all on function public.public_quote_instant_order(jsonb,jsonb) from public",
    );
    expect(migration).toContain(
      "grant execute on function public.public_quote_instant_order(jsonb,jsonb) to anon, authenticated",
    );
    expect(migration).toContain(
      "revoke all on function public.submit_instant_order_v5(text,text,jsonb,text,text,jsonb) from public",
    );
  });
});
