import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260723040736_restrict_inventory_carry_forward_to_controlled_stock.sql", import.meta.url),
  "utf8",
);
const admin = readFileSync(new URL("./OperationContentAdmin.tsx", import.meta.url), "utf8");

describe("continuidade do estoque entre dias", () => {
  it("mantém apenas saldos numéricos e nunca sobrescreve o estoque da nova data", () => {
    expect(migration).toContain("previous.quantity_available is not null");
    expect(migration).toContain("on conflict (flavor_id, service_date) do nothing");
    expect(migration).not.toContain("update public.flavor_availability");
  });

  it("explica na operação que o estoque não zera com a data", () => {
    expect(admin).toContain("O estoque continua de um dia para o outro");
    expect(admin).toContain("<span>Estoque atual</span>");
  });
});
