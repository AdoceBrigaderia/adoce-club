import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const operation = readFileSync("src/OperationInstantOrders.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260815192217_restore_staff_update_instant_order_grant.sql",
  "utf8",
);

describe("atualização de pedidos imediatos pela equipe", () => {
  it("mantém cancelamento e mudanças de etapa ligados à RPC protegida", () => {
    expect(operation).toContain('rpc("staff_update_instant_order"');
    expect(operation).toContain("next_cancellation_reason: reason || null");
  });

  it("libera somente a equipe autenticada e mantém anon bloqueado", () => {
    expect(migration).toContain(
      "grant execute on function public.staff_update_instant_order(uuid, text, text, timestamptz, text, text)",
    );
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("has_function_privilege(\n    'anon'");
    expect(migration).toContain("has_function_privilege(\n    'authenticated'");
  });
});
