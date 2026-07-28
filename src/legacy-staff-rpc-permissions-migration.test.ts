import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260726162430_tighten_legacy_staff_reads.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("permissões dos RPCs antigos", () => {
  it("protege o financeiro com capacidade específica", () => {
    expect(migration).toContain("staff_financial_sales_summary");
    expect(migration).toContain("staff_has_any_capability('view_finance')");
    expect(migration).toContain("Acesso financeiro nao autorizado");
  });

  it("protege clientes e leitura por QR", () => {
    expect(migration).toContain("staff_search_customers");
    expect(migration).toContain("staff_lookup_customer_by_qr");
    expect(migration.match(/staff_has_any_capability\('manage_customers'\)/g)?.length).toBe(2);
  });

  it("protege configurações comerciais", () => {
    expect(migration).toContain("staff_get_commerce_settings");
    expect(migration).toContain("staff_has_any_capability('manage_settings')");
  });

  it("mantém as funções como security definer com search_path fechado", () => {
    expect(migration.match(/security definer/g)?.length).toBeGreaterThanOrEqual(5);
    expect(migration.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
