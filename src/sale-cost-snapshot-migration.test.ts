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

  it("stores snapshots only in a private table keyed by the sold item, never in public columns", () => {
    const table = sql.match(/create table private\.instant_order_item_cost_snapshots \((.*?)\);/)?.[1] ?? "";
    expect(table).toContain("instant_order_item_id uuid primary key");
    for (const name of snapshotColumns) expect(table).toContain(name);
    expect(sql).not.toMatch(/alter table public\.instant_order_items/);
    expect(sql).toMatch(/table_unit_price_snapshot numeric\(\d+,\s*\d+\)/);
    expect(sql).toMatch(/unit_cost_snapshot numeric\(\d+,\s*\d+\)/);
    expect(sql).toMatch(/cost_breakdown_snapshot jsonb/);
    expect(sql).toMatch(/cost_snapshot_at timestamptz/);
    expect(sql).not.toMatch(/references public\.instant_order_items.*on delete cascade/);
  });

  it("restricts confidence to historical, estimated_current or missing", () => {
    const values = sql.match(/check\s*\(cost_confidence in\s*\(([^)]+)\)\)/)?.[1];
    expect(values?.match(/'[^']+'/g)).toEqual(["'historical'", "'estimated_current'", "'missing'"]);
  });

  it("captures only new items and preserves an existing private snapshot", () => {
    const trigger = sql.match(/create trigger instant_order_items_snapshot_cost (.*?);/)?.[1] ?? "";
    expect(trigger).toMatch(/^after insert on public\.instant_order_items for each row/);
    expect(trigger).not.toMatch(/\bupdate\b/);
    expect(trigger).toContain("execute function private.snapshot_instant_order_item_cost()");
    expect(sql).toMatch(/if exists \( select 1 from private\.instant_order_item_cost_snapshots where instant_order_item_id = new\.id \) then return new; end if/);
    expect(sql).toContain("on conflict (instant_order_item_id) do nothing");
  });

  it("captures the flavor table price separately from the charged item price", () => {
    expect(sql).toMatch(/select f\.base_price, c\.unit_cost, c\.updated_at/);
    expect(sql).toMatch(/from public\.flavors f left join public\.flavor_costs c on c\.flavor_id = f\.id where f\.id = new\.flavor_id/);
    expect(sql).toMatch(/insert into private\.instant_order_item_cost_snapshots \( instant_order_item_id, table_unit_price_snapshot, unit_cost_snapshot, cost_confidence, cost_breakdown_snapshot, cost_snapshot_at \) values \( new\.id, table_price, current_cost, confidence, breakdown, captured_at \)/);
    expect(sql).toContain("'charged_unit_price', new.unit_price");
    expect(sql).not.toMatch(/new\.unit_price\s*:=/);
  });

  it("records missing costs without substituting zero and dates captured costs as historical", () => {
    expect(sql).toMatch(/confidence := case when current_cost is null then 'missing' else 'historical' end/);
    expect(sql).not.toMatch(/coalesce\s*\(\s*(?:c\.unit_cost|current_cost)\s*,\s*0/);
    expect(sql).toMatch(/captured_at timestamptz := (?:statement_timestamp|clock_timestamp|now)\(\)/);
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
    expect(sql).not.toMatch(/insert into private\.instant_order_item_cost_snapshots[^;]+\bselect\b/);
    expect(sql).not.toMatch(/\bupdate\s+private\.instant_order_item_cost_snapshots\b/);
  });

  it("rejects private snapshot rewrites, deletion and truncation independently of public item updates", () => {
    const guard = sql.match(/function private\.preserve_instant_order_item_cost\(\)(.*?)\$function\$;/)?.[1] ?? "";
    expect(guard).toContain("raise exception");
    expect(sql).toMatch(/create trigger instant_order_item_cost_snapshots_immutable before update or delete on private\.instant_order_item_cost_snapshots for each row execute function private\.preserve_instant_order_item_cost\(\)/);
    expect(sql).toMatch(/create trigger instant_order_item_cost_snapshots_no_truncate before truncate on private\.instant_order_item_cost_snapshots for each statement execute function private\.preserve_instant_order_item_cost\(\)/);
    expect(sql).not.toMatch(/before update on public\.instant_order_items/);
  });

  it("enables private RLS and revokes all browser table access", () => {
    expect(sql).toContain("alter table private.instant_order_item_cost_snapshots enable row level security");
    expect(sql).toContain("revoke all on table private.instant_order_item_cost_snapshots from public, anon, authenticated");
    expect(sql).not.toMatch(/create policy|grant\s+(?:select|all|insert|update|delete)/);
  });

  it("keeps privileged lookups private, fixes search_path and grants no new public access", () => {
    expect(sql).toMatch(/function private\.snapshot_instant_order_item_cost\(\) returns trigger language plpgsql security definer set search_path = ''/);
    for (const name of ["snapshot_instant_order_item_cost", "preserve_instant_order_item_cost"]) {
      expect(sql).toContain(`revoke all on function private.${name}() from public, anon, authenticated`);
    }
    expect(sql).not.toMatch(/\bgrant\b|disable row level security|drop policy/);
  });
});
