import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260728115000_product_profitability_workspace.sql",
    import.meta.url,
  ),
  "utf8",
);

const autoProfileMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260728115100_product_profitability_autoprofile.sql",
    import.meta.url,
  ),
  "utf8",
);

const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("rentabilidade dos produtos comerciais", () => {
  it("cria perfil único de custo, preço, rendimento e margem por produto", () => {
    expect(migration).toContain(
      "create table if not exists public.commercial_product_costing_settings",
    );
    expect(migration).toContain("product_id uuid primary key");
    expect(migration).toContain("manual_total_cost");
    expect(migration).toContain("sale_price_override");
    expect(migration).toContain("yield_quantity");
    expect(migration).toContain("minimum_margin");
  });

  it("cria automaticamente perfil provisório para cada novo produto", () => {
    expect(autoProfileMigration).toContain(
      "private.ensure_commercial_product_costing_settings",
    );
    expect(autoProfileMigration).toContain(
      "commercial_products_create_costing_profile",
    );
    expect(autoProfileMigration).toContain("after insert on public.commercial_products");
    expect(autoProfileMigration).toContain("default_yield := 13");
    expect(autoProfileMigration).toContain("raw_yield ~");
  });

  it("aceita custo provisório e ficha técnica versionada sem perder histórico", () => {
    expect(migration).toContain("'recipe_snapshot'");
    expect(migration).toContain("'manual_provisional'");
    expect(migration).toContain("recipe_version_id");
    expect(migration).toContain("cost_snapshot_id");
    expect(migration).not.toContain("delete from public.costing_cost_snapshots");
    expect(migration).not.toContain("update public.costing_cost_snapshots");
  });

  it("calcula custo, preço, lucro, margem, markup e custo por rendimento no servidor", () => {
    expect(migration).toContain("private.commercial_product_effective_cost");
    expect(migration).toContain("private.commercial_product_effective_sale_price");
    expect(migration).toContain("'effective_total_cost'");
    expect(migration).toContain("'gross_profit'");
    expect(migration).toContain("'margin'");
    expect(migration).toContain("'markup'");
    expect(migration).toContain("'cost_per_yield'");
    expect(migration).toContain("'margin_alert'");
  });

  it("confirma que ficha e snapshot pertencem ao produto selecionado", () => {
    expect(migration).toContain("recipe.commercial_product_id = target_product_id");
    expect(migration).toContain("Snapshot de custo não pertence ao produto");
    expect(migration).toContain("Ficha técnica não pertence ao produto");
  });

  it("mantém custos fora das superfícies públicas e usa o BFF", () => {
    expect(migration).toContain(
      "revoke all on public.commercial_product_costing_settings from public, anon, authenticated",
    );
    for (const rpc of [
      "manager_get_product_profitability_workspace",
      "manager_save_product_costing_settings",
    ]) {
      expect(migration).toContain(`public.${rpc}`);
      expect(policy).toContain(`\"${rpc}\"`);
    }
    expect(migration).not.toContain("grant select on public.commercial_product_costing_settings to anon");
    expect(autoProfileMigration).toContain(
      "revoke all on function private.ensure_commercial_product_costing_settings() from public, anon, authenticated",
    );
  });

  it("permanece transacional e sem coordenadas de produção", () => {
    for (const sql of [migration, autoProfileMigration]) {
      expect(sql.trimStart()).toMatch(/^begin;/);
      expect(sql.trimEnd()).toMatch(/commit;$/);
      expect(sql).not.toContain("uefwywizqhfvvijaopcn");
      expect(sql).not.toContain("adocebrigaderia.com.br");
      expect(sql).not.toContain("--prod");
    }
  });
});
