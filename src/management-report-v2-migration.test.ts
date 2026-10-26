import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../supabase/migrations/20261026144500_management_report_v2.sql", import.meta.url);
const source = existsSync(migrationUrl) ? readFileSync(migrationUrl, "utf8") : "";
// Static migration contract only: database execution is a separate integration gate.
const sql = source.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();

describe("management report v2 migration contract", () => {
  it("adds a separate report without replacing the legacy RPC or mutating facts", () => {
    expect(existsSync(migrationUrl)).toBe(true);
    expect(sql).toContain("function public.manager_management_report_v2(start_date date, end_date date)");
    expect(sql).not.toMatch(/(?:drop|create(?: or replace)?) function public\.manager_management_report\(/);
    expect(sql).not.toMatch(/\b(?:insert into|update|delete from|truncate|alter table|create table)\b/);
  });

  it("rejects anonymous and nonmanager callers before reading private facts", () => {
    expect(sql).toContain("if auth.uid() is null or not private.is_manager() then raise exception");
    expect(sql.indexOf("if auth.uid()")).toBeLessThan(sql.indexOf("legacy :="));
    expect(sql).toContain("stable security definer set search_path = ''");
    expect(sql).toContain("revoke all on function public.manager_management_report_v2(date, date) from public, anon");
    expect(sql).toContain("grant execute on function public.manager_management_report_v2(date, date) to authenticated");
    expect(sql).not.toMatch(/grant .* on (?:table|schema)/);
  });

  it("bounds the inclusive date range to 400 days and compares an equal preceding period", () => {
    expect(sql).toContain("start_date is null or end_date is null or end_date < start_date");
    expect(sql).toContain("end_date - start_date + 1 > 400");
    expect(sql).toContain("prev_end := start_date - 1");
    expect(sql).toContain("prev_start := start_date - (end_date - start_date + 1)");
  });

  it("keeps the existing sales, daily, receipts and correction definitions authoritative", () => {
    expect(sql).toContain("legacy := public.manager_management_report(start_date, end_date)");
    expect(sql).toContain("previous_legacy := public.manager_management_report(prev_start, prev_end)");
    expect(sql).toContain("return legacy ||");
    expect(sql).toContain("o.status = 'completed'");
    expect(sql).toContain("coalesce(o.completed_at, o.created_at) at time zone 'america/fortaleza'");
    expect(sql).toContain("from private.cash_sale_conference_corrections");
    expect(sql).toContain("'daily', previous_legacy->'daily'");
  });

  it("reads snapshots only through effective sold items and never reprices historical costs", () => {
    expect(sql).toContain("left join private.instant_order_item_cost_snapshots s on s.instant_order_item_id = i.id");
    expect(sql).toContain("when s.instant_order_item_id is not null then s.unit_cost_snapshot");
    expect(sql).toContain("when s.instant_order_item_id is not null then case");
    expect(sql).toContain("s.unit_cost_snapshot is not null and s.cost_confidence in ('historical', 'estimated_current')");
    expect(sql).toContain("when c.unit_cost is not null then 'estimated_current' else 'missing'");
    expect(sql).not.toContain("coalesce(s.unit_cost_snapshot, c.unit_cost)");
  });

  it("allocates effective order revenue with cent reconciliation, including unitemized revenue", () => {
    expect(sql).toContain("round(order_total * 100)");
    expect(sql).toContain("sum(rounded_revenue_cents) over (partition by order_id)");
    expect(sql).toContain("'missing'::text");
    expect(sql).toContain("not exists (select 1 from item_weights i where i.order_id = d.id and i.weight > 0)");
    expect(sql).toContain("case when i.is_reward then 0 else i.unit_price * i.quantity end");
  });

  it("reconciles estimated fees by confidence bucket without declaring them actual", () => {
    expect(sql).toContain("fees_cents - sum(rounded_fee_cents) over (partition by period_key)");
    expect(sql).toContain("'fees_allocated_proportionally'");
    expect(sql).toContain("'feesestimatedcents', fees_cents");
    expect(sql).toContain("'feesactualcents', null");
  });

  it("subtracts only covered cost from covered net revenue and preserves partial confidence", () => {
    expect(sql).toContain("confidence in ('historical', 'estimated_current')");
    expect(sql).toContain("covered_revenue_cents - cogs_cents");
    expect(sql).toContain("'ispartial', is_partial");
    expect(sql).toContain("bool_or(confidence <> 'historical' and has_activity)");
    for (const key of ["historicalunitspercent", "historicalrevenuepercent", "coveredunitspercent", "coveredrevenuepercent", "missingunitspercent"]) {
      expect(sql).toContain(`'${key}'`);
    }
  });

  it("separates operating expense, withdrawal, supply and unclassified pro-labore", () => {
    for (const kind of ["expense", "withdrawal", "supply"]) expect(sql).toContain(`kind = '${kind}'`);
    expect(sql).toContain("'pro_labore', 0");
    expect(sql).toContain("'prolaborecents', 0");
    expect(sql).toContain("'pro_labore_not_classified'");
    expect(sql).not.toMatch(/notes\s*(?:~|ilike|like)|(?:substring|regexp_match)\s*\(\s*notes/);
    expect(sql).toContain("covered_revenue_cents - cogs_cents - losses_cents - expenses_cents");
  });

  it("keeps unavailable cost classes unknown rather than inventing absorbed fixed costs", () => {
    expect(sql).toContain("'variable_material_packaging', null");
    expect(sql).toContain("'allocated_fixed', null");
    expect(sql).toContain("'absorbedfixedcostscents', null");
    expect(sql).toContain("'unclassifiedcogscents', cogs_cents");
    expect(sql).toContain("'cost_classes_unallocated'");
  });

  it("exposes result, coverage, classes, cash, receivables and comparison with explicit limits", () => {
    for (const block of ["result", "coverage", "cost_classes", "cash", "receivables", "comparison", "warnings"]) expect(sql).toContain(`'${block}'`);
    for (const warning of ["partial_cost_coverage", "estimated_current_costs", "missing_costs", "losses_estimated_current", "missing_loss_costs"]) expect(sql).toContain(`'${warning}'`);
    expect(sql).toContain("'basis', 'current_position'");
    expect(sql).toContain("'items', legacy->'receivables'");
    expect(sql).toContain("'receivedcents'");
    expect(sql).toContain("'cashdifferencecents'");
  });
});
