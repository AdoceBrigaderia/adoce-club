import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../supabase/migrations/20261026143000_sale_item_cost_snapshots.sql", import.meta.url);
const migration = existsSync(migrationUrl) ? readFileSync(migrationUrl, "utf8") : "";
// Check executable SQL, so comments cannot satisfy a safety requirement.
const sql = migration.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();
const snapshotColumns = [
  "table_unit_price_snapshot", "unit_cost_snapshot", "cost_confidence",
  "cost_breakdown_snapshot", "cost_snapshot_at",
];

describe("prospective sale item cost snapshot migration contract", () => {
  it("provides the migration before accepting its contract", () => {
    expect(existsSync(migrationUrl), "prospective snapshot migration is missing").toBe(true);
  });

  it("keeps all five snapshot columns nullable and without defaults for old rows", () => {
    for (const name of snapshotColumns) {
      const definition = sql.match(new RegExp(`add column(?: if not exists)? ${name} (.*?)(?=,? add column|;|,? add constraint)`))?.[1];
      expect(definition, `missing nullable column ${name}`).toBeDefined();
      expect(definition).not.toMatch(/\bnot null\b|\bdefault\b|\bgenerated\b/);
    }
    expect(sql).toMatch(/table_unit_price_snapshot numeric\(\d+,\s*\d+\)/);
    expect(sql).toMatch(/unit_cost_snapshot numeric\(\d+,\s*\d+\)/);
    expect(sql).toMatch(/cost_breakdown_snapshot jsonb/);
    expect(sql).toMatch(/cost_snapshot_at timestamptz/);
  });

  it("restricts confidence to historical, estimated_current or missing", () => {
    const values = sql.match(/check\s*\(cost_confidence in\s*\(([^)]+)\)\)/)?.[1];
    expect(values?.match(/'[^']+'/g)).toEqual(["'historical'", "'estimated_current'", "'missing'"]);
  });

  it("captures only inserts with no snapshot fields supplied", () => {
    const trigger = sql.match(/create trigger instant_order_items_snapshot_cost (.*?);/)?.[1] ?? "";
    expect(trigger).toMatch(/^before insert on public\.instant_order_items for each row when\s*\(/);
    expect(trigger).not.toMatch(/\bupdate\b/);
    for (const name of snapshotColumns) expect(trigger).toContain(`new.${name} is null`);
    expect(trigger).toContain("execute function private.snapshot_instant_order_item_cost()");
  });

  it("captures the flavor table price separately from the charged item price", () => {
    expect(sql).toMatch(/select f\.base_price, c\.unit_cost, c\.updated_at/);
    expect(sql).toMatch(/from public\.flavors f left join public\.flavor_costs c on c\.flavor_id = f\.id where f\.id = new\.flavor_id/);
    expect(sql).toContain("new.table_unit_price_snapshot := table_price");
    expect(sql).toContain("new.unit_cost_snapshot := current_cost");
    expect(sql).not.toMatch(/new\.unit_price\s*:=/);
  });

  it("records missing costs without substituting zero and dates captured costs as historical", () => {
    expect(sql).toMatch(/new\.cost_confidence := case when current_cost is null then 'missing' else 'historical' end/);
    expect(sql).not.toMatch(/coalesce\s*\(\s*(?:c\.unit_cost|current_cost)\s*,\s*0/);
    expect(sql).toMatch(/new\.cost_snapshot_at := (?:statement_timestamp|clock_timestamp|now)\(\)/);
  });

  it("preserves source, source version and available classifications without inventing allocations", () => {
    expect(sql).toContain("'schema_version', 1");
    expect(sql).toContain("'table', 'public.flavor_costs'");
    expect(sql).toContain("'column', 'unit_cost'");
    expect(sql).toContain("'updated_at', source_updated_at");
    expect(sql).toContain("'flavor_id', new.flavor_id");
    expect(sql).toContain("'table', 'public.flavors'");
    expect(sql).toContain("'column', 'base_price'");
    expect(sql).toContain("'version_number', v.version_number");
    expect(sql).toContain("'item_kind', i.item_kind");
    expect(sql).toContain("'resource_kind', a.resource_kind");
    expect(sql).toContain("'allocation_status', 'unallocated_manual_total'");
    expect(sql).toContain("'size_code', v.size_code");
    expect(sql).toContain("v.size_code = 'g'");
  });

  it("does not backfill, rewrite or delete historical sale items", () => {
    expect(sql).not.toMatch(/\bupdate\s+(?:public\.)?instant_order_items\b/);
    expect(sql).not.toMatch(/\b(?:insert into|delete from|truncate(?: table)?)\s+(?:public\.)?instant_order_items\b/);
    expect(sql).not.toMatch(/\balter column\b.*\bset (?:default|not null)\b/);
  });

  it("rejects modifications to every snapshot field while permitting ordinary item updates", () => {
    const guard = sql.match(/function private\.preserve_instant_order_item_cost\(\)(.*?)\$function\$;/)?.[1] ?? "";
    expect(guard).toContain("is distinct from");
    for (const name of snapshotColumns) {
      expect(guard).toContain(`new.${name}`);
      expect(guard).toContain(`old.${name}`);
    }
    expect(guard).toContain("raise exception");
    expect(guard).toContain("return new");
    expect(sql).toMatch(/create trigger instant_order_items_preserve_cost before update on public\.instant_order_items for each row execute function private\.preserve_instant_order_item_cost\(\)/);
  });

  it("keeps privileged lookups private, fixes search_path and grants no new public access", () => {
    expect(sql).toMatch(/function private\.snapshot_instant_order_item_cost\(\) returns trigger language plpgsql security definer set search_path = ''/);
    for (const name of ["snapshot_instant_order_item_cost", "preserve_instant_order_item_cost"]) {
      expect(sql).toContain(`revoke all on function private.${name}() from public, anon, authenticated`);
    }
    expect(sql).not.toMatch(/\bgrant\b|disable row level security|drop policy/);
  });
});
