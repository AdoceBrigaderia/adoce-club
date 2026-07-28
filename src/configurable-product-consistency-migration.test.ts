import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260728224500_configurable_product_consistency_and_crm.sql", import.meta.url),
  "utf8",
);
const seed = readFileSync(
  new URL("../supabase/migrations/20260728225000_real_configurable_product_catalog.sql", import.meta.url),
  "utf8",
);
const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);
const crm = readFileSync(new URL("./CustomerServiceRequestHistory.tsx", import.meta.url), "utf8");
const catalog = readFileSync(new URL("./ConfigurableProductCatalogPage.tsx", import.meta.url), "utf8");
const admin = readFileSync(new URL("./OperationProductCatalog.tsx", import.meta.url), "utf8");

describe("consistência dos produtos configuráveis", () => {
  it("recalcula pacotes e regras de grupo também no backend", () => {
    expect(migration).toContain("pricing_tiers :=");
    expect(migration).toContain("Escolha um dos pacotes disponíveis");
    expect(migration).toContain("rules->'groupLimits'");
    expect(migration).toContain("rules->'groupMinimums'");
    expect(migration).toContain("A quantidade máxima é %");
    expect(migration).toContain("'schema_version', 2");
    expect(migration).toContain("'requested_quantity', target_quantity");
  });

  it("trata a cotação como total do pedido sem multiplicar novamente as opções", () => {
    expect(migration).toContain("target_cake_quote jsonb default null");
    expect(migration).not.toContain("target_configuration_quote");
    expect(migration).toContain("resolved_total_cost := round(resolved_base_cost + quote_option_cost, 4)");
    expect(migration).toContain("resolved_total_price := quote_estimated_price");
    expect(migration).toContain("resolved_unit_cost := round(resolved_total_cost / target_quantity, 4)");
    expect(migration).not.toContain("quote_option_cost) * target_quantity");
    expect(migration).toContain("commercial_product_profitability_v2");
  });

  it("remove custos internos da Operação e do CRM não financeiro", () => {
    expect(migration).toContain("private.redact_internal_product_configuration");
    expect(migration).toContain("where entry.key not in");
    expect(migration).toContain("'unit_cost'");
    expect(migration).toContain("else private.redact_internal_product_configuration(configured.canonical_selection)");
    expect(migration).toContain("staff_get_customer_service_request_history");
    expect(policy).toContain('"staff_get_customer_service_request_history"');
    expect(crm).toContain('bffRpc<ServiceRequestHistoryRow[]>("staff_get_customer_service_request_history"');
  });

  it("publica apenas regras públicas e mantém custo de opção zerado no catálogo", () => {
    expect(migration).toContain("'priceTiers', product.configuration_rules->'priceTiers'");
    expect(migration).toContain("'groupMinimums', product.configuration_rules->'groupMinimums'");
    expect(migration).toContain("'unit_cost', 0");
    expect(migration).not.toMatch(/get_configurable_product_catalog[\s\S]*?'unit_cost', option\.unit_cost/);
  });

  it("usa pacotes no site e permite administrá-los no cadastro central", () => {
    expect(catalog).toContain("Escolha o pacote");
    expect(catalog).toContain("Total estimado");
    expect(admin).toContain("Pacotes fechados");
    expect(admin).toContain("groupMinimums");
    expect(admin).toContain("Modo definido pelo tipo");
  });

  it("estrutura somente dados reais já presentes e não inventa biscoitos", () => {
    expect(seed).toContain("docinhos-tradicionais");
    expect(seed).toContain("docinhos-especiais");
    expect(seed).toContain("escola-recreio-completo");
    expect(seed).toContain("product.details->'packages'");
    expect(seed).toContain("product.details->'choices'->'sucos'");
    expect(seed).toContain("awaiting_validation");
    expect(seed).not.toMatch(/insert into public\.commercial_products/i);
    expect(seed).not.toContain("biscoitos personalizados");
  });

  it("lê corretamente os elementos JSON dos pacotes e preserva grupos reais", () => {
    expect(seed).toContain("package(value)");
    expect(seed).toContain("package.value->>'quantity'");
    expect(seed).toContain("package.value->>'flavors'");
    expect(seed).toContain("package.value->>'price'");
    expect(seed).not.toMatch(/package->>'(?:quantity|flavors|price)'/);
    expect(seed).toContain("with ordinality flavor(label, ordinality)");
    expect(seed).toContain("with ordinality juice(label, ordinality)");
    expect(seed).toContain("'groupLimits', jsonb_build_object('sucos', 2)");
    expect(seed).toContain("'groupMinimums', jsonb_build_object('sucos', 2)");
  });

  it("mantém docinhos fechados e permite adicionais administráveis nos kits escolares", () => {
    expect(seed).toMatch(/product_type = 'sweet'[\s\S]*?'allowAddons', false/);
    expect(seed).toMatch(/product_type = 'school_kit'[\s\S]*?'allowAddons', true/);
    expect(seed).toContain("incluindo pacotes, quantidade incluída, adicionais");
  });

  it("permanece transacional e isolado da produção", () => {
    for (const sql of [migration, seed]) {
      expect(sql.trimStart()).toMatch(/^begin;/);
      expect(sql.trimEnd()).toMatch(/commit;$/);
      expect(sql).not.toContain("uefwywizqhfvvijaopcn");
      expect(sql).not.toMatch(/truncate|drop table/i);
    }
  });
});
