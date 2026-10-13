import { convertQuantity, type PlanInvoice, type PlanItem } from "./purchase-planner";
import { shoppingWeekLabel, weekStart } from "./shopping-week";

export type WeeklyPurchaseRow = { itemId: string; week: string; quantity: number; total: number };
export type WeeklyPurchaseGroup = { week: string; label: string; total: number; rows: (WeeklyPurchaseRow & { item: PlanItem })[] };

export function weeklyPurchaseTotals(invoices: PlanInvoice[], items: PlanItem[]): WeeklyPurchaseRow[] {
  const byItem = new Map(items.map(item => [item.id, item]));
  const totals = new Map<string, WeeklyPurchaseRow>();
  for (const invoice of invoices) {
    const week = weekStart(invoice.issued_on);
    for (const line of invoice.lines) {
      const item = byItem.get(line.item_id);
      if (!item) continue;
      const quantity = convertQuantity(Number(line.normalized_quantity), line.normalized_unit, item.consumption_unit);
      if (quantity == null) continue;
      const key = `${week}|${item.id}`;
      const existing = totals.get(key) || { itemId: item.id, week, quantity: 0, total: 0 };
      existing.quantity += quantity;
      existing.total += Number(line.net_total) || 0;
      totals.set(key, existing);
    }
  }
  return [...totals.values()];
}

export function weeklyPurchaseGroups(invoices: PlanInvoice[], items: PlanItem[]): WeeklyPurchaseGroup[] {
  const byItem = new Map(items.map(item => [item.id, item]));
  const byWeek = new Map<string, WeeklyPurchaseGroup>();
  for (const row of weeklyPurchaseTotals(invoices, items)) {
    const item = byItem.get(row.itemId);
    if (!item) continue;
    const group = byWeek.get(row.week) || { week: row.week, label: shoppingWeekLabel(row.week), total: 0, rows: [] };
    group.rows.push({ ...row, item });
    group.total += row.total;
    byWeek.set(row.week, group);
  }
  for (const group of byWeek.values()) group.rows.sort((a, b) => a.item.name.localeCompare(b.item.name, "pt-BR"));
  return [...byWeek.values()].sort((a, b) => b.week.localeCompare(a.week));
}
