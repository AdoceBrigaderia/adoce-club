import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260728170246_festival_slice_yield_overrides.sql",
    import.meta.url,
  ),
  "utf8",
);
const baseProfitabilityMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260728115000_product_profitability_workspace.sql",
    import.meta.url,
  ),
  "utf8",
);
const component = readFileSync(
  new URL("./OperationProductProfitability.tsx", import.meta.url),
  "utf8",
);
const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("Festival de Fatias", () => {
  it("mantém o rendimento padrão e registra exceção por ação ou evento sem duplicar produto", () => {
    expect(baseProfitabilityMigration).toContain(
      "create table if not exists public.commercial_product_costing_settings",
    );
    expect(baseProfitabilityMigration).toContain("yield_quantity numeric(16,4)");
    expect(migration).toContain(
      "create table if not exists public.commercial_product_yield_overrides",
    );
    expect(migration).toContain("context_type in ('action', 'event')");
    expect(migration).toContain("unique (product_id, context_type, context_key)");
    expect(migration).toContain(
      "product_id uuid not null references public.commercial_products(id)",
    );
    expect(migration).not.toContain("insert into public.commercial_products");
  });

  it("calcula custo e rentabilidade por fatia exclusivamente no backend", () => {
    for (const contract of [
      "private.commercial_product_slice_quote_json",
      "'standard_yield_quantity'",
      "'applied_yield_quantity'",
      "'total_cost'",
      "'cost_per_slice'",
      "'authorized_slice_price'",
      "'gross_profit_per_slice'",
      "'projected_gross_profit'",
      "'margin'",
      "'markup'",
      "'minimum_margin'",
      "'margin_alert'",
    ]) {
      expect(migration).toContain(contract);
    }
    expect(component).not.toContain("const preview = useMemo");
    expect(component).not.toContain("profit / salePrice");
    expect(component).not.toContain("salePrice / cost");
    expect(component).not.toContain("cost / Math.max");
    expect(component).not.toContain("next_authorized_slice_price");
    expect(component).toContain("requested_slice_price");
    expect(component).toContain("selectedYieldOverride.cost_per_slice");
    expect(component).toContain("selectedYieldOverride.authorized_slice_price");
  });

  it("autoriza a configuração somente por RPC interna de gerente e BFF", () => {
    expect(migration).toContain(
      "create or replace function public.manager_save_product_yield_override",
    );
    expect(migration).toContain("if not private.is_manager()");
    expect(migration).toContain(
      "revoke all on public.commercial_product_yield_overrides from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.manager_save_product_yield_override",
    );
    expect(component).toContain(
      'bffRpc<Workspace>("manager_save_product_yield_override"',
    );
    expect(component).toContain(
      '"manager_capture_product_yield_sale_snapshot"',
    );
    expect(component).toContain('"festival-yield-sale-snapshot"');
    expect(component).toContain("pendingOperationKey");
    expect(component).toContain("completeOperation");
    expect(component).not.toContain("requireSupabase");
    expect(policy).toContain('"manager_save_product_yield_override"');
    expect(policy).toContain('"manager_capture_product_yield_sale_snapshot"');
  });

  it("registra snapshot idempotente e imutável do contexto usado na venda", () => {
    expect(migration).toContain(
      "create table if not exists public.commercial_product_yield_sale_snapshots",
    );
    expect(migration).toContain("snapshot_key uuid not null unique");
    expect(migration).toContain("sale_reference text not null");
    expect(migration).toContain(
      "create or replace function public.manager_capture_product_yield_sale_snapshot",
    );
    expect(migration).toContain(
      "commercial_product_yield_sale_snapshot_immutable",
    );
    expect(migration).toContain("before update or delete");
    expect(migration).toContain(
      "'calculation_source', 'commercial_product_slice_quote_v1'",
    );
    expect(migration).toContain("jsonb_build_object('idempotent', true)");
    expect(component).toContain("Registrar snapshot da venda");
    expect(component).toContain("target_sale_reference");
  });

  it("mantém tabelas financeiras sem acesso direto e a migration transacional", () => {
    expect(migration).toContain(
      "alter table public.commercial_product_yield_overrides enable row level security",
    );
    expect(migration).toContain(
      "alter table public.commercial_product_yield_sale_snapshots enable row level security",
    );
    expect(migration).toContain(
      "revoke all on public.commercial_product_yield_sale_snapshots from public, anon, authenticated",
    );
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
    expect(migration).not.toContain("--prod");
    expect(migration).not.toContain("supabase db push");
  });
});
