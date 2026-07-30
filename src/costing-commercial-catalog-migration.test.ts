import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260728093000_costing_commercial_catalog.sql",
    import.meta.url,
  ),
  "utf8",
);

const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("catálogo comercial unificado de custos", () => {
  it("classifica fabricação própria, compra, acervo, serviço e custo provisório", () => {
    expect(migration).toContain("create table if not exists public.costing_item_commercial_settings");
    for (const origin of [
      "manufactured",
      "purchased",
      "asset",
      "service",
      "manual_provisional",
    ]) {
      expect(migration).toContain(`'${origin}'`);
    }
  });

  it("calcula custo efetivo, lucro, margem e markup no servidor", () => {
    expect(migration).toContain("private.costing_effective_unit_cost");
    expect(migration).toContain("'gross_profit'");
    expect(migration).toContain("'margin'");
    expect(migration).toContain("'markup'");
    expect(migration).toContain("'margin_alert'");
    expect(migration).toContain("acquisition_cost / settings.expected_uses");
  });

  it("preserva histórico de compra sem sobrescrever preços anteriores", () => {
    expect(migration).toContain("insert into public.costing_item_prices");
    expect(migration).toContain("manager_add_costing_item_price");
    expect(migration).not.toContain("delete from public.costing_item_prices");
    expect(migration).not.toContain("update public.costing_item_prices");
  });

  it("restringe leitura e alteração a owner ou manager pelo BFF", () => {
    expect(migration).toContain("if not private.is_manager()");
    expect(migration).toContain(
      "revoke all on public.costing_item_commercial_settings from public, anon, authenticated",
    );
    for (const rpc of [
      "manager_get_costing_catalog_workspace",
      "manager_save_costing_catalog_item",
      "manager_add_costing_item_price",
    ]) {
      expect(migration).toContain(`public.${rpc}`);
      expect(policy).toContain(`\"${rpc}\"`);
    }
  });

  it("não aceita custo, margem ou preço em superfície pública", () => {
    expect(migration).not.toContain("grant select on public.costing_item_commercial_settings to anon");
    expect(migration).not.toContain("grant select on public.costing_item_commercial_settings to authenticated");
    expect(migration).not.toContain("public_get_costing");
  });

  it("permanece transacional e não contém coordenadas produtivas", () => {
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
    expect(migration).not.toContain("uefwywizqhfvvijaopcn");
    expect(migration).not.toContain("adocebrigaderia.com.br");
    expect(migration).not.toContain("--prod");
  });
});
