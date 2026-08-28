import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildInstantOrderEditPayload } from "./OperationInstantOrders";

const operation = readFileSync(new URL("./OperationInstantOrders.tsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260821200524_secure_instant_order_editing.sql", import.meta.url),
  "utf8",
);
const rollback = readFileSync(
  new URL("../supabase/rollbacks/20260821200524_secure_instant_order_editing.rollback.sql", import.meta.url),
  "utf8",
);

describe("edição restrita de pedidos imediatos", () => {
  it("agrupa as unidades por sabor sem perder a calda individual", () => {
    expect(buildInstantOrderEditPayload([
      { key: "a", flavorId: "brigadeiro", sauceId: "caramelo" },
      { key: "b", flavorId: "brigadeiro", sauceId: "" },
      { key: "c", flavorId: "morango", sauceId: "chocolate" },
    ])).toEqual([
      {
        flavor_id: "brigadeiro",
        quantity: 2,
        sauces: [{ sauce_id: "caramelo" }, { sauce_id: null }],
      },
      {
        flavor_id: "morango",
        quantity: 1,
        sauces: [{ sauce_id: "chocolate" }],
      },
    ]);
  });

  it("liga a interface somente às duas RPCs específicas", () => {
    expect(operation).toContain('rpc("staff_edit_instant_order_items"');
    expect(operation).toContain('rpc("staff_mark_existing_instant_order_item_reward"');
    expect(operation).toContain('rpc("staff_set_instant_order_reward_item_scoped"');
    expect(operation).toContain("Editar itens do pedido");
    expect(operation).toContain("Marcar uma fatia já escolhida");
    expect(operation).toContain("awaiting_confirmation\", \"reserved\", \"awaiting_payment");
  });

  it("mantém autenticação, equipe, loja, etapa, estoque e auditoria no servidor", () => {
    expect(migration).toContain("(select auth.uid()) is null or not private.is_staff()");
    expect(migration).toContain("private.can_manage_orders_at_store(current_order.store_id)");
    expect(migration).toContain("current_order.status not in ('awaiting_confirmation', 'reserved', 'awaiting_payment')");
    expect(migration).toContain("for update");
    expect(migration).toContain("staff_edit_instant_order_items");
    expect(migration).toContain("staff_mark_existing_instant_order_item_reward");
    expect(migration).toContain("insert into public.audit_events");
  });

  it("concede execução apenas a authenticated e comprova que anon segue bloqueado", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("'anon'");
    expect(migration).toContain("RPCs de edicao de pedido nao podem ser executadas por anon");
    expect(migration).toContain("has_function_privilege(\n    'authenticated',\n    'public.staff_set_instant_order_reward_item(uuid,uuid)'");
  });

  it("possui reversão explícita das novas RPCs", () => {
    expect(rollback).toContain("drop function if exists public.staff_edit_instant_order_items");
    expect(rollback).toContain("drop function if exists public.staff_mark_existing_instant_order_item_reward");
    expect(rollback).toContain("drop function if exists public.staff_set_instant_order_reward_item_scoped");
  });
});
