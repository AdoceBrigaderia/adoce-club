import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);
const liveAllowlist = readFileSync(
  new URL("../supabase/tests/authenticated_rpc_allowlist_live.sql", import.meta.url),
  "utf8",
);
const supersededMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260729120500_lock_superseded_rpc_versions.sql",
    import.meta.url,
  ),
  "utf8",
);
const storeRlsLive = readFileSync(
  new URL("../supabase/tests/store_rls_boundary_live.sql", import.meta.url),
  "utf8",
);
const storeWriteLockMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260729155500_lock_store_scoped_table_writes.sql",
    import.meta.url,
  ),
  "utf8",
);
const storeRlsWorkflow = readFileSync(
  new URL(
    "../.github/workflows/store-rls-boundary-live-homologation.yml",
    import.meta.url,
  ),
  "utf8",
);

function tsArray(name: string) {
  const match = policy.match(
    new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`),
  );
  expect(match, `${name} não encontrada`).not.toBeNull();
  return [...(match?.[1] || "").matchAll(/"([a-z0-9_]+)"/g)].map(
    (item) => item[1],
  );
}

function sqlArray(name: string) {
  const match = liveAllowlist.match(
    new RegExp(`${name} text\\[\\] := array\\[([\\s\\S]*?)\\];`),
  );
  expect(match, `${name} não encontrada`).not.toBeNull();
  return [...(match?.[1] || "").matchAll(/'([a-z0-9_]+)'/g)].map(
    (item) => item[1],
  );
}

const superseded = [
  "staff_create_manual_sale_in_cash",
  "staff_record_cash_movement",
  "submit_instant_order_v5",
] as const;
const current = [
  "staff_create_manual_sale_in_cash_v2",
  "staff_record_cash_movement_v2",
  "submit_instant_order_v6",
] as const;
const dedicatedAuthenticated = [
  "customer_complete_registration",
  "customer_prepare_google_wallet_pass",
  "manager_assert_site_visual_access",
  "manager_save_site_visual_asset",
  "manager_assert_dynamic_image_access",
  "manager_assert_gallery_media_access",
  "manager_save_gallery_media_asset",
] as const;

describe("superfície autenticada de RPCs", () => {
  it("mantém todas as RPCs genéricas do BFF dentro do ensaio vivo", () => {
    const allowed = new Set(sqlArray("allowed"));
    const operation = tsArray("OPERATION_RPC_ALLOWLIST");
    const client = tsArray("CLIENT_RPC_ALLOWLIST");

    expect(operation.length).toBeGreaterThan(50);
    expect(client).toEqual([
      "customer_create_store_checkin",
      "customer_get_account_workspace",
      "issue_customer_qr",
    ]);
    expect(new Set([...operation, ...client]).size).toBe(
      operation.length + client.length,
    );
    for (const rpc of [...operation, ...client]) expect(allowed.has(rpc)).toBe(true);
  });

  it("trata toda entrada liberada como obrigatória e elimina tolerância legada", () => {
    expect(liveAllowlist).toContain("from unnest(allowed) expected_name");
    expect(liveAllowlist).not.toContain("transitional text[][]");
    expect(liveAllowlist).not.toContain("transition_count");

    const allowed = new Set(sqlArray("allowed"));
    for (const rpc of superseded) expect(allowed.has(rpc)).toBe(false);
    for (const rpc of current) expect(allowed.has(rpc)).toBe(true);
    for (const rpc of dedicatedAuthenticated) expect(allowed.has(rpc)).toBe(true);
  });

  it("revoga versões substituídas e exige as versões roteadas atuais", () => {
    for (const rpc of superseded) expect(supersededMigration).toContain(`'${rpc}'`);
    for (const rpc of current) expect(supersededMigration).toContain(`'${rpc}'`);
    expect(supersededMigration).toContain(
      "revoke all on function %I.%I(%s) from public, anon, authenticated",
    );
    expect(supersededMigration).toContain(
      "grant execute on function %I.%I(%s) to service_role",
    );
    expect(supersededMigration).toContain("p.prosecdef");
    expect(supersededMigration).toContain(
      "has_function_privilege('authenticated', p.oid, 'EXECUTE')",
    );
    expect(supersededMigration).toContain(
      "Superseded RPC versions remain exposed to browser roles",
    );
  });
});

describe("fronteira RLS das tabelas por loja", () => {
  it("exige RLS e proíbe privilégios, policies anônimas ou escrita direta", () => {
    for (const table of [
      "stores",
      "cash_registers",
      "staff_store_assignments",
      "cash_sessions",
      "cash_movements",
    ]) {
      expect(storeRlsLive).toContain(`'${table}'`);
      expect(storeWriteLockMigration).toContain(`'${table}'`);
    }
    expect(storeRlsLive).toContain("not class.relrowsecurity");
    expect(storeRlsLive).toContain("has_table_privilege('anon'");
    expect(storeRlsLive).toContain("has_table_privilege('authenticated'");
    expect(storeRlsLive).toContain("Direct authenticated writes bypass the RPC boundary");
    expect(storeRlsLive).toContain("Anonymous RLS policies found");
    expect(storeRlsLive).toContain("authenticated_write_policies");
    expect(storeRlsLive).toContain(
      "Authenticated write policies remain inside the RPC-only store boundary",
    );
    expect(storeWriteLockMigration).toContain(
      "revoke insert, update, delete, truncate on table",
    );
    expect(storeWriteLockMigration).toContain("from public, anon, authenticated");
    for (const policyName of [
      "stores_manager_insert",
      "stores_manager_update",
      "cash_registers_manager_insert",
      "cash_registers_manager_update",
      "staff_store_assignments_manager_all",
    ]) {
      expect(storeWriteLockMigration).toContain(`drop policy if exists ${policyName}`);
    }
    expect(storeWriteLockMigration).toContain(
      "Store-scoped browser write policies remain after lockdown",
    );
  });

  it("exige predicados de loja e recusa policies vazias ou tautológicas", () => {
    expect(storeRlsLive).toContain("private.can_access_store(id)");
    expect(storeRlsLive).toContain("private.can_access_store(store_id)");
    expect(storeRlsLive).toContain("private.is_manager()");
    expect(storeRlsLive).toContain("auth.uid()");
    expect(storeRlsLive).toContain("Store isolation predicates missing");
    expect(storeRlsLive).toContain("dangerous_read_policies");
    expect(storeRlsLive).toContain("policy.qual is null");
    expect(storeRlsLive).toContain("lower(btrim(policy.qual)) in ('true', '(true)')");
    expect(storeRlsLive).toContain("Tautological or empty store read policies detected");
    expect(storeRlsLive).toMatch(/^begin;/m);
    expect(storeRlsLive).toMatch(/^rollback;/m);
  });

  it("mantém a execução manual isolada da produção", () => {
    expect(storeRlsWorkflow).toContain("workflow_dispatch:");
    expect(storeRlsWorkflow).not.toMatch(/^\s*push:/m);
    expect(storeRlsWorkflow).toContain(
      "EXPECTED_BRANCH: reestruturacao/ux-crm-operacao-imagens-v1",
    );
    expect(storeRlsWorkflow).toContain(
      'test "$CONFIRMATION" = "AUDITAR RLS SOMENTE HOMOLOGACAO $HOMOLOGATION_REF"',
    );
    expect(storeRlsWorkflow).toContain("SUPABASE_HOMOLOGATION_DB_URL");
    expect(storeRlsWorkflow).toContain("Referência de produção detectada e bloqueada");
    expect(storeRlsWorkflow).toContain("supabase/tests/store_rls_boundary_live.sql");
    expect(storeRlsWorkflow).not.toContain("netlify deploy");
    expect(storeRlsWorkflow).not.toContain("supabase db push");
  });
});
