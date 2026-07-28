import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260728130000_service_request_pricing_snapshots.sql",
    import.meta.url,
  ),
  "utf8",
);

const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("snapshot financeiro imutável das encomendas", () => {
  it("cria um snapshot único por solicitação com custo, preço, lucro e margem", () => {
    expect(migration).toContain(
      "create table if not exists public.service_request_pricing_snapshots",
    );
    expect(migration).toContain(
      "request_id uuid primary key references public.service_requests(id) on delete restrict",
    );
    for (const field of [
      "unit_cost",
      "unit_price",
      "total_cost",
      "total_price",
      "gross_profit",
      "margin",
      "markup",
      "minimum_margin",
      "margin_alert",
      "calculation_snapshot",
    ]) {
      expect(migration).toContain(field);
    }
  });

  it("impede alteração e exclusão do valor histórico", () => {
    expect(migration).toContain(
      "private.prevent_service_request_pricing_snapshot_mutation",
    );
    expect(migration).toContain(
      "before update or delete on public.service_request_pricing_snapshots",
    );
    expect(migration).toContain(
      "O snapshot financeiro da encomenda é imutável",
    );
    expect(migration).not.toContain(
      "on conflict (request_id) do update",
    );
  });

  it("calcula no servidor usando a rentabilidade vigente do produto", () => {
    expect(migration).toContain(
      "private.commercial_product_profitability_json(target_product_id)",
    );
    expect(migration).toContain(
      "resolved_total_cost := round(resolved_unit_cost * target_quantity, 4)",
    );
    expect(migration).toContain(
      "resolved_total_price := round(resolved_unit_price * target_quantity, 2)",
    );
    expect(migration).toContain(
      "resolved_profit := round(resolved_total_price - resolved_total_cost, 4)",
    );
    expect(migration).toContain("resolved_margin := case");
    expect(migration).toContain("resolved_markup := case");
  });

  it("preserva a montagem e soma adicionais ao custo e ao preço administrativos", () => {
    expect(migration).toContain(
      "cake_quote := private.canonicalize_cake_builder_selection",
    );
    expect(migration).toContain(
      "insert into public.service_request_cake_builds",
    );
    expect(migration).toContain(
      "quote_price_adjustment := round(greatest(quote_estimated_price - catalog_base_price, 0), 2)",
    );
    expect(migration).toContain(
      "resolved_unit_cost := round(base_unit_cost + quote_option_cost, 4)",
    );
    expect(migration).toContain(
      "resolved_unit_price := round(base_unit_price + quote_price_adjustment, 2)",
    );
    expect(migration).toContain("'cake_builder_quote', normalized_quote");
  });

  it("não aceita custo, preço ou margem enviados pelo cliente", () => {
    expect(migration).not.toContain("target_selections->>'price'");
    expect(migration).not.toContain("target_selections->>'cost'");
    expect(migration).not.toContain("target_selections->>'margin'");
    expect(migration).toContain(
      "pricing_snapshot_captured := private.capture_service_request_pricing_snapshot",
    );
    expect(migration).toContain(
      "'pricing_snapshot_captured', pricing_snapshot_captured",
    );
  });

  it("preserva seleção, ficha técnica e snapshot de custo usados no pedido", () => {
    expect(migration).toContain("selection_snapshot");
    expect(migration).toContain("recipe_version_id");
    expect(migration).toContain("cost_snapshot_id");
    expect(migration).toContain("'schema_version', 1");
    expect(migration).toContain(
      "'calculation_source', 'commercial_product_profitability_v1'",
    );
    expect(migration).toContain("'captured_at', to_jsonb(now())");
  });

  it("mantém custos invisíveis ao público e consultáveis só por manager no BFF", () => {
    expect(migration).toContain(
      "revoke all on public.service_request_pricing_snapshots from public, anon, authenticated",
    );
    expect(migration).toContain("if not private.is_manager() then");
    expect(migration).toContain(
      "public.manager_get_service_request_pricing_snapshot",
    );
    expect(policy).toContain(
      '"manager_get_service_request_pricing_snapshot"',
    );
    expect(migration).not.toContain(
      "grant select on public.service_request_pricing_snapshots to anon",
    );
  });

  it("permanece transacional, idempotente e isolado da produção", () => {
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
    expect(migration).toContain("on conflict (request_id) do nothing");
    expect(migration).toContain("get diagnostics inserted_count = row_count");
    expect(migration).not.toContain("uefwywizqhfvvijaopcn");
    expect(migration).not.toContain("adocebrigaderia.com.br");
    expect(migration).not.toContain("--prod");
  });
});
