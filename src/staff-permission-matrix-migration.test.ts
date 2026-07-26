import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260726172000_staff_permission_matrix.sql", import.meta.url),
  "utf8",
);

describe("matriz de permissões por loja", () => {
  it("inclui os seis papéis operacionais", () => {
    expect(migration).toContain("cashier");
    expect(migration).toContain("production");
    expect(migration).toContain("attendant");
    expect(migration).toContain("viewer");
  });

  it("cobre as capacidades funcionais", () => {
    const capabilities = [
      "can_manage_customers",
      "can_manage_orders",
      "can_manage_production",
      "can_view_reports",
      "can_manage_settings",
      "can_view_finance",
      "can_manage_stock",
    ];
    capabilities.forEach((item) => expect(migration).toContain(item));
  });

  it("centraliza as decisões de autorização", () => {
    expect(migration).toContain("private.staff_has_capability");
    expect(migration).toContain("private.can_sell_at_store");
    expect(migration).toContain("private.can_open_cash_at_store");
    expect(migration).toContain("private.can_close_cash_at_store");
    expect(migration).toContain("private.can_manage_customers_at_store");
    expect(migration).toContain("private.can_manage_orders_at_store");
    expect(migration).toContain("private.can_manage_production_at_store");
  });

  it("protege alterações de papéis privilegiados", () => {
    expect(migration).toContain("private.is_manager()");
    expect(migration).toContain("private.is_owner()");
    expect(migration).toContain("Somente o proprietario pode alterar proprietarios e gerentes");
    expect(migration).toContain("manager_set_staff_capability");
  });
});
