import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260728170501_serialize_and_deduplicate_cash_operations.sql",
    import.meta.url,
  ),
  "utf8",
);
const quickCash = readFileSync(
  new URL("./OperationQuickCash.tsx", import.meta.url),
  "utf8",
);
const manualSale = readFileSync(
  new URL("./OperationManualSale.tsx", import.meta.url),
  "utf8",
);
const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("serialização e idempotência do caixa", () => {
  it("trava a sessão antes de movimentar ou cancelar", () => {
    expect(migration).toMatch(
      /staff_record_cash_movement_v2[\s\S]*from public\.cash_sessions[\s\S]*for update;[\s\S]*staff_record_cash_movement\(/,
    );
    expect(migration).toMatch(
      /manager_cancel_empty_cash_session[\s\S]*from public\.cash_sessions[\s\S]*for update;[\s\S]*from public\.cash_movements/,
    );
  });

  it("repete venda e movimento sem duplicar efeitos financeiros", () => {
    expect(migration).toContain("private.staff_operation_requests");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("previous_request.response_payload");
    expect(migration).toContain("jsonb_build_object('idempotent', true)");
    expect(migration).toMatch(
      /revoke all on function public\.staff_record_cash_movement\([\s\S]*authenticated, service_role;/,
    );
  });

  it("expõe somente as versões idempotentes ao BFF ativo", () => {
    expect(policy).toContain('"staff_record_cash_movement_v2"');
    expect(policy).toContain('"staff_create_manual_sale_in_cash_v2"');
    expect(policy).not.toMatch(/"staff_record_cash_movement",/);
    expect(policy).not.toMatch(/"staff_create_manual_sale_in_cash",/);
    expect(quickCash).toContain('"staff_record_cash_movement_v2"');
    expect(manualSale).toContain('"staff_create_manual_sale_in_cash_v2"');
    for (const source of [quickCash, manualSale]) {
      expect(source).toContain("pendingOperationKey");
      expect(source).toContain("requested_operation_key: operation.value");
      expect(source).toContain("completeOperation(operation.fingerprint)");
    }
  });
});
