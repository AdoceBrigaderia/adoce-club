import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const operation = readFileSync("src/OperationContentAdmin.tsx", "utf8");
const catalog = readFileSync("src/AdoceHoje.tsx", "utf8");
const checkout = readFileSync("src/InstantOrderPanel.tsx", "utf8");
const orderOperation = readFileSync("src/OperationInstantOrders.tsx", "utf8");
const manualSale = readFileSync("src/OperationManualSale.tsx", "utf8");
const thermalPrinter = readFileSync("src/lib/thermal-printer.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260815110239_add_inventory_availability_batches.sql",
  "utf8",
);

describe("cadeia completa dos lotes de fatias", () => {
  it("permite vários lotes por sabor na operação", () => {
    expect(operation).toContain("Lotes por horário");
    expect(operation).toContain("staff_upsert_flavor_availability_batch");
    expect(operation).toContain("staff_delete_flavor_availability_batch");
  });

  it("mostra a disponibilidade por horário e calcula o pedido completo", () => {
    expect(catalog).toContain("get_public_flavor_availability_batches");
    expect(catalog).toContain("formatBatchAvailability");
    expect(checkout).toContain("latestRequiredPickupTime");
    expect(checkout).toContain("Seu pedido completo pode ser retirado");
  });

  it("exposes only the safe batch summary to public visitors", () => {
    expect(migration).toContain(
      "revoke all on public.flavor_availability_batches\n  from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant select on public.flavor_availability_batches to authenticated",
    );
    expect(migration).not.toContain("flavor_availability_batches_public_read");
    expect(migration).toMatch(
      /create or replace function public\.get_public_flavor_availability_batches[\s\S]*?security definer/,
    );
    expect(migration).toContain(
      "grant execute on function public.get_public_flavor_availability_batches(date)\n  to anon, authenticated",
    );
  });

  it("envia horário e responsável pela retirada em campos estruturados", () => {
    expect(checkout).toContain('rpc("submit_instant_order_v7"');
    expect(checkout).toContain("requested_operation_key");
    expect(checkout).toContain("requested_pickup_time");
    expect(checkout).toContain("requested_pickup_method");
    expect(orderOperation).toContain("pickup_requested_time");
    expect(thermalPrinter).toContain("pickup_requested_time");
  });

  it("reserva, paga e cancela os lotes dentro da transação do pedido", () => {
    expect(migration).toContain("private.allocate_instant_order_item_batches");
    expect(migration).toContain("private.finish_instant_order_item_batches");
    expect(migration).toContain("instant_order_items_sync_batches");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("requested_pickup_time between hour.opens_at and hour.closes_at");
  });

  it("devolve uma repetição idempotente antes de revalidar horário ou estoque", () => {
    const idempotentReturn = migration.indexOf("previous_request.response_payload");
    const timeValidation = migration.indexOf("requested_pickup_time < local_time");
    const stockValidation = migration.indexOf("private.flavor_batch_quantity_by_time(", timeValidation);
    expect(idempotentReturn).toBeGreaterThan(-1);
    expect(idempotentReturn).toBeLessThan(timeValidation);
    expect(idempotentReturn).toBeLessThan(stockValidation);
  });

  it("mantém a venda manual em uma rota exclusiva da equipe", () => {
    expect(manualSale).toContain('rpc("staff_submit_instant_order_v5"');
    expect(migration).toContain("not private.is_staff()");
    expect(migration).toContain("revoke all on function public.submit_instant_order_v5");
    expect(migration).toContain("grant execute on function public.get_checkout_payment_methods()");
  });

  it("hashes the normalized phone as text for the public rate limit", () => {
    expect(migration).toContain(
      "'phone:' || (normalized_request->>'customer_phone')",
    );
    expect(migration).not.toContain(
      "'phone:' || normalized_request->>'customer_phone'",
    );
  });

  it("restores financial defaults when a new online order is inserted", () => {
    expect(migration).toContain("if tg_op = 'INSERT' then");
    expect(migration).toContain(
      "new.gross_amount := coalesce(new.gross_amount, new.total, 0)",
    );
    expect(migration).toContain(
      "before insert or update of status, payment_status on public.instant_orders",
    );
    expect(migration).toContain(
      "execute function private.apply_instant_order_global_rules()",
    );
  });
});
