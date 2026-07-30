import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260728103000_cake_builder_costing_catalog_links.sql",
    import.meta.url,
  ),
  "utf8",
);

const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

const operation = readFileSync(
  new URL("./OperationCakeBuilderSettings.tsx", import.meta.url),
  "utf8",
);

describe("integração do montador com o catálogo de custos", () => {
  it("vincula opções a itens técnicos sem remover o modo manual", () => {
    expect(migration).toContain("add column if not exists costing_item_id uuid");
    expect(migration).toContain("add column if not exists costing_sync_enabled boolean");
    expect(migration).toContain("if not new.costing_sync_enabled then");
    expect(migration).toContain("new.unit_cost :=");
    expect(migration).toContain("new.price_adjustment :=");
  });

  it("recalcula opções vinculadas quando custo ou preço muda", () => {
    expect(migration).toContain("private.refresh_cake_builder_options_for_costing_item");
    expect(migration).toContain("costing_settings_refresh_cake_builder");
    expect(migration).toContain("costing_prices_refresh_cake_builder");
    expect(migration).toContain("where option.costing_item_id = target_item_id");
    expect(migration).toContain("and option.costing_sync_enabled");
  });

  it("mantém custos internos restritos a owner e manager pelo BFF", () => {
    for (const rpc of [
      "manager_get_cake_builder_costing_workspace",
      "manager_save_cake_builder_costing_links",
    ]) {
      expect(migration).toContain(`public.${rpc}`);
      expect(migration).toContain("if not private.is_manager()");
      expect(policy).toContain(`\"${rpc}\"`);
    }
    expect(migration).not.toContain("grant select on public.costing_item_commercial_settings to anon");
    expect(migration).not.toContain("public_get_cake_builder_costing");
  });

  it("impede vínculo cruzado entre tortas e itens bloqueados", () => {
    expect(migration).toContain("template.product_id = target_product_id");
    expect(migration).toContain("settings.commercial_status <> 'blocked'");
    expect(migration).toContain("A opção % não pertence à torta selecionada");
  });

  it("integra seleção, sincronização e resumo de margem na operação", () => {
    expect(operation).toContain("manager_get_cake_builder_costing_workspace");
    expect(operation).toContain("manager_save_cake_builder_costing_links");
    expect(operation).toContain("Item do catálogo de custos");
    expect(operation).toContain("Custo e preço manuais");
    expect(operation).toContain("Sincronizar");
    expect(operation).toContain("lucro");
    expect(operation).toContain("margem");
  });

  it("permanece transacional e não contém coordenadas produtivas", () => {
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
    expect(migration).not.toContain("uefwywizqhfvvijaopcn");
    expect(migration).not.toContain("adocebrigaderia.com.br");
    expect(migration).not.toContain("--prod");
  });
});
