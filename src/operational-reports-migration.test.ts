import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260726224902_operational_reports_hub.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("relatórios consolidados da operação", () => {
  it("exige a capacidade de relatórios e respeita acesso por loja", () => {
    expect(migration).toContain("staff_has_any_capability('view_reports')");
    expect(migration).toContain("private.can_view_reports_at_store(target_store_id)");
    expect(migration).toContain("private.can_view_reports_at_store(customer_order.store_id)");
    expect(migration).toContain("private.can_view_reports_at_store(session.store_id)");
    expect(migration).toContain("private.can_view_reports_at_store(checkin.store_id)");
  });

  it("calcula valores somente a partir de pedidos aprovados no banco", () => {
    expect(migration).toContain("customer_order.payment_status::text = 'approved'");
    expect(migration).toContain("sum(gross_amount)");
    expect(migration).toContain("sum(payment_fee_amount)");
    expect(migration).toContain("sum(net_amount)");
    expect(migration).toContain("avg(gross_amount)");
  });

  it("consolida vendas, produtos, fidelidade, check-ins e caixa", () => {
    expect(migration).toContain("'sales_by_day'");
    expect(migration).toContain("'payment_methods'");
    expect(migration).toContain("'top_products'");
    expect(migration).toContain("'stamps_added'");
    expect(migration).toContain("'checkins'");
    expect(migration).toContain("'cash_absolute_difference'");
  });

  it("protege a função pública", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("revoke all on function public.staff_get_operational_reports(date,date,uuid) from public, anon");
    expect(migration).toContain("grant execute on function public.staff_get_operational_reports(date,date,uuid) to authenticated");
  });
});
