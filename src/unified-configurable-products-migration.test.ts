import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260728220000_unified_configurable_products.sql", import.meta.url),
  "utf8",
);
const publicFunction = readFileSync(
  new URL("../netlify/functions/public-service-request.ts", import.meta.url),
  "utf8",
);
const allowlist = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("cadastro unificado e montadores por tipo", () => {
  it("modela torta, docinho, biscoito, kit escolar e produto fixo", () => {
    expect(migration).toContain("product_type in ('cake','sweet','cookie','school_kit','fixed')");
    expect(migration).toContain("customization_mode in ('none','cake_builder','option_groups')");
    expect(migration).toContain("configuration_rules jsonb");
    expect(migration).toContain("option_kind in ('flavor','variant','format','theme','packaging','addon')");
  });

  it("mantém escolhas estruturadas em snapshot imutável e sem acesso direto", () => {
    expect(migration).toContain("create table if not exists public.service_request_product_configurations");
    expect(migration).toContain("canonical_selection jsonb not null");
    expect(migration).toContain("selection_summary jsonb not null");
    expect(migration).toContain("estimated_internal_cost numeric");
    expect(migration).toContain("before update or delete on public.service_request_product_configurations");
    expect(migration).toContain("revoke all on public.service_request_product_configurations from public, anon, authenticated");
    expect(migration).not.toContain("grant select on public.service_request_product_configurations to authenticated");
  });

  it("recalcula IDs, custos e acréscimos no backend", () => {
    expect(migration).toContain("private.canonicalize_configurable_product_selection");
    expect(migration).toContain("option.product_id = product_row.id");
    expect(migration).toContain("option.active and option.published");
    expect(migration).toContain("total_price_adjustment := total_price_adjustment + option_row.price_adjustment * option_quantity");
    expect(migration).toContain("total_internal_cost := total_internal_cost + option_row.unit_cost * option_quantity");
    expect(migration).toContain("private.capture_service_request_pricing_snapshot");
  });

  it("não expõe custo interno no catálogo público", () => {
    expect(migration).toContain("create or replace function public.get_configurable_product_catalog");
    expect(migration).toContain("'unit_cost', 0");
    expect(migration).not.toMatch(/get_configurable_product_catalog[\s\S]*?'unit_cost', option\.unit_cost/);
  });

  it("exige manager nas escritas administrativas e BFF explícito", () => {
    expect(migration).toContain("manager_get_configurable_product_workspace");
    expect(migration).toContain("manager_save_configurable_product");
    expect(migration).toContain("if not private.is_manager()");
    expect(allowlist).toContain('"manager_get_configurable_product_workspace"');
    expect(allowlist).toContain('"manager_save_configurable_product"');
  });

  it("preserva product_configuration no BFF público e rejeita montadores misturados", () => {
    expect(publicFunction).toContain("sanitizeProductConfiguration");
    expect(publicFunction).toContain("selectionSource.product_configuration");
    expect(publicFunction).toContain("product_configuration: productConfiguration");
    expect(publicFunction).toContain("A solicitação contém montadores incompatíveis");
  });
});
