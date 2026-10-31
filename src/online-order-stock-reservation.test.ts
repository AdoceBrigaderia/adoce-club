import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261030141706_fix_online_order_reservation_and_unavailable_status.sql",
    import.meta.url,
  ),
  "utf8",
);
const publicCart = readFileSync(new URL("./InstantOrderPanel.tsx", import.meta.url), "utf8");
const operationQueue = readFileSync(new URL("./OperationInstantOrders.tsx", import.meta.url), "utf8");

describe("reserva de estoque dos pedidos online", () => {
  it("mantém o carrinho público sem reservar e reserva somente pela ação do operador", () => {
    expect(publicCart).toContain('rpc("submit_instant_order_v7"');
    expect(publicCart).not.toContain('rpc("staff_update_instant_order"');
    expect(operationQueue).toContain("Registrar reserva no estoque");
    expect(operationQueue).toContain('update("reserved")');
    expect(migration).toContain("item.status = 'reserved'");
    expect(migration).not.toMatch(/item\.status\s+in\s*\([^)]*'selected'/);
  });

  it("usa indisponível, e nunca esgotado, quando o saldo livre chega a zero", () => {
    expect(migration).toContain("when free_quantity = 0 then 'unavailable'");
    expect(migration).not.toContain("when free_quantity = 0 then 'sold_out'");
    expect(migration).toContain("free_quantity > 0");
    expect(migration).toContain("old_free_quantity = 0");
  });

  it("não leva saldo zerado ou indisponível para o dia seguinte", () => {
    expect(migration).toContain("previous.status not in ('sold_out', 'unavailable')");
    expect(migration).toContain(") > 0");
    expect(migration).toContain("quantity_reserved, updated_by, updated_at");
  });
});
