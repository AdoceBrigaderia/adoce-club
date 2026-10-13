import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("lista completa de clientes no caixa", () => {
  it("usa uma consulta propria, alfabetica e sem o limite da busca rapida", () => {
    const selector = readFileSync(new URL("./CashCustomerSelector.tsx", import.meta.url), "utf8");
    const migration = readFileSync(new URL("../supabase/migrations/20261012090000_hide_removed_cash_customers.sql", import.meta.url), "utf8");

    expect(selector).toContain('rpc("staff_list_cash_customers")');
    expect(selector).toContain('list="cash-customer-options"');
    expect(selector).toContain("final ${digits.slice(-4)}");
    expect(migration).toContain("create or replace function public.staff_list_cash_customers()");
    expect(migration).toContain("order by lower(p.full_name), p.full_name");
    expect(migration).toContain("p.account_status = 'active'");
    expect(migration).toContain("where p.active");
    expect(migration).not.toContain("limit 30");
  });
});
