import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260726174225_quick_sale_catalog.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("catálogo rápido de venda", () => {
  it("exige permissão específica para vender", () => {
    expect(migration).toContain("staff_get_quick_sale_catalog");
    expect(migration).toContain("staff_has_any_capability('sell')");
    expect(migration).toContain("Voce nao possui permissao para vender");
  });

  it("calcula disponibilidade e preço no PostgreSQL", () => {
    expect(migration).toContain("public.flavors");
    expect(migration).toContain("public.flavor_availability");
    expect(migration).toContain("flavor.base_price");
    expect(migration).toContain("quantity_available");
    expect(migration).toContain("quantity_reserved");
    expect(migration).toContain("greatest(");
  });

  it("entrega somente métodos de pagamento ativos", () => {
    expect(migration).toContain("public.payment_methods");
    expect(migration).toContain("where method.active");
  });

  it("mantém menor privilégio e search_path fechado", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      "revoke all on function public.staff_get_quick_sale_catalog(date) from public, anon",
    );
    expect(migration).toContain(
      "grant execute on function public.staff_get_quick_sale_catalog(date) to authenticated",
    );
  });
});
