import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727052305_lock_unrouted_authenticated_rpcs.sql",
    import.meta.url,
  ),
  "utf8",
);
const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

const retiredNames = [
  "accept_group_invite",
  "complete_forced_password_change",
  "customer_group_overview",
  "owner_remove_stamps",
  "staff_finalize_instant_order_direct",
  "staff_record_purchase",
  "staff_redeem_reward",
  "staff_update_instant_order",
] as const;

describe("RPCs autenticados fora da superfície BFF", () => {
  it.each(retiredNames)("bloqueia %s para o navegador", (name) => {
    expect(migration).toContain(`'${name}'`);
    expect(policy).not.toContain(`"${name}"`);
  });

  it("retira anon/authenticated e preserva somente manutenção server-side", () => {
    expect(migration).toContain(
      "revoke all on function %I.%I(%s) from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function %I.%I(%s) to service_role",
    );
  });

  it("possui gate contra reabertura acidental", () => {
    expect(migration).toContain("has_function_privilege('anon', p.oid, 'EXECUTE')");
    expect(migration).toContain(
      "has_function_privilege('authenticated', p.oid, 'EXECUTE')",
    );
    expect(migration).toContain("unrouted authenticated RPCs remain exposed");
  });
});
