import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const maintenance = readFileSync(
  new URL("../supabase/maintenance/homologation/20260729_new_module_fk_indexes.sql", import.meta.url),
  "utf8",
);
const liveAudit = readFileSync(
  new URL("../supabase/tests/homologation_new_module_fk_indexes_live.sql", import.meta.url),
  "utf8",
);

const expectedIndexes = [
  "idx_cake_builder_options_costing_snapshot_id",
  "idx_costing_recipe_components_child_recipe_version_id",
  "idx_costing_recipe_components_item_id",
  "idx_service_request_cake_builds_template_id",
  "idx_service_request_pricing_snapshots_cost_snapshot_id",
  "idx_service_request_pricing_snapshots_recipe_version_id",
  "idx_service_request_product_configurations_product_id",
];

describe("índices das relações novas da homologação", () => {
  it("usa manutenção idempotente, transacional e sem comandos destrutivos", () => {
    expect(maintenance.trimStart()).toMatch(/^begin;/);
    expect(maintenance.trimEnd()).toMatch(/commit;$/);
    expect(maintenance).toContain("pg_advisory_xact_lock");
    expect(maintenance.match(/create index if not exists/g)).toHaveLength(7);
    expect(maintenance).not.toMatch(/drop index|drop table|truncate|delete from/i);
  });

  it("cobre exatamente as sete FKs novas sem índice", () => {
    for (const indexName of expectedIndexes) {
      expect(maintenance).toContain(indexName);
      expect(liveAudit).toContain(indexName);
    }
    expect(maintenance).toContain("cake_builder_options(costing_snapshot_id)");
    expect(maintenance).toContain("costing_recipe_components(child_recipe_version_id)");
    expect(maintenance).toContain("costing_recipe_components(item_id)");
    expect(maintenance).toContain("service_request_cake_builds(template_id)");
    expect(maintenance).toContain("service_request_pricing_snapshots(cost_snapshot_id)");
    expect(maintenance).toContain("service_request_pricing_snapshots(recipe_version_id)");
    expect(maintenance).toContain("service_request_product_configurations(product_id)");
  });

  it("audita validade, prontidão e primeira coluna coberta", () => {
    expect(liveAudit.trimStart()).toMatch(/^\\set ON_ERROR_STOP on/);
    expect(liveAudit.trimEnd()).toMatch(/rollback;$/);
    expect(liveAudit).toContain("index_record.indisvalid");
    expect(liveAudit).toContain("index_record.indisready");
    expect(liveAudit).toContain("index_record.indkey[0] = target_attribute");
    expect(liveAudit).toContain("pg_get_indexdef");
  });
});
