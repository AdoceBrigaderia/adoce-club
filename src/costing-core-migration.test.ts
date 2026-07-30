import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260728090000_costing_core_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("núcleo versionado de custos e produção", () => {
  it("cria catálogo, fichas técnicas, componentes, recursos e snapshots", () => {
    for (const table of [
      "costing_items",
      "costing_item_prices",
      "costing_recipes",
      "costing_recipe_versions",
      "costing_recipe_components",
      "costing_resource_allocations",
      "costing_cost_snapshots",
      "costing_channel_prices",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
    }
  });

  it("preserva histórico por versão, vigência e snapshot imutável", () => {
    expect(migration).toContain("version_number integer not null");
    expect(migration).toContain("unique (recipe_id, version_number)");
    expect(migration).toContain("valid_from timestamptz");
    expect(migration).toContain("source_hash text not null");
    expect(migration).toContain("unique (recipe_version_id, source_hash)");
    expect(migration).toContain("cost_snapshot_id uuid not null references public.costing_cost_snapshots");
  });

  it("distingue custo manual provisório de ficha técnica e snapshot validado", () => {
    expect(migration).toContain("cost_source_status text not null default 'manual_provisional'");
    expect(migration).toContain("'technical_sheet'");
    expect(migration).toContain("'validated_snapshot'");
    expect(migration).toContain("costing_item_id uuid references public.costing_items");
    expect(migration).toContain(
      "costing_recipe_version_id uuid references public.costing_recipe_versions",
    );
    expect(migration).toContain("cake_builder_options_single_cost_source_check");
  });

  it("modela perdas, rendimento, tempos e rateio de recursos", () => {
    expect(migration).toContain("default_loss_percent numeric(7,4)");
    expect(migration).toContain("yield_quantity numeric(16,6)");
    expect(migration).toContain("active_minutes numeric(12,2)");
    expect(migration).toContain("passive_minutes numeric(12,2)");
    expect(migration).toContain("shared_units numeric(16,6)");
    expect(migration).toContain("'equipment_time'");
  });

  it("mantém dados internos invisíveis para navegador e disponíveis ao BFF", () => {
    for (const table of [
      "costing_items",
      "costing_item_prices",
      "costing_recipes",
      "costing_recipe_versions",
      "costing_recipe_components",
      "costing_resource_allocations",
      "costing_cost_snapshots",
      "costing_channel_prices",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(
        `revoke all on public.${table} from public, anon, authenticated`,
      );
      expect(migration).toContain(`grant all on public.${table} to service_role`);
    }
  });

  it("não executa deploy, não referencia produção e permanece transacional", () => {
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
    expect(migration).not.toContain("uefwywizqhfvvijaopcn");
    expect(migration).not.toContain("adocebrigaderia.com.br");
    expect(migration).not.toContain("--prod");
  });
});
