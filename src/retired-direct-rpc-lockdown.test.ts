import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727124000_lock_retired_direct_rpcs.sql",
    import.meta.url,
  ),
  "utf8",
);

const retiredRpcs = [
  "get_instant_order",
  "begin_whatsapp_verification",
  "customer_claim_verified_whatsapp_registration",
  "record_owner_production_rollback",
] as const;

describe("bloqueio dos RPCs diretos aposentados", () => {
  it.each(retiredRpcs)("inclui %s no corte definitivo", (rpc) => {
    expect(migration).toContain(`'${rpc}'`);
  });

  it("remove execução de todos os papéis do navegador", () => {
    expect(migration).toContain(
      "revoke all on function %I.%I(%s) from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function %I.%I(%s) to service_role",
    );
  });

  it("interrompe a migration se algum RPC continuar exposto", () => {
    expect(migration).toContain(
      "has_function_privilege('anon', p.oid, 'EXECUTE')",
    );
    expect(migration).toContain(
      "has_function_privilege('authenticated', p.oid, 'EXECUTE')",
    );
    expect(migration).toContain("remains exposed to browser roles");
  });
});
