import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const catalog = readFileSync(resolve(root, "src/CommercialCatalog.tsx"), "utf8");
const admin = readFileSync(resolve(root, "src/OperationCommercialAdmin.tsx"), "utf8");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260720171949_add_event_subcategories.sql"),
  "utf8",
);

describe("subcategorias de eventos", () => {
  it("separa Tabuleiro e Mini Festas no catálogo público", () => {
    expect(catalog).toContain('aria-label="Tipos de eventos"');
    expect(catalog).toContain("eventSubcategoryLabels");
    expect(catalog).toContain('filter === "Tabuleiro"');
    expect(catalog).toContain('product.subcategory === "trays"');
    expect(catalog).toContain('filter === "Mini Festas"');
    expect(catalog).toContain('product.subcategory === "mini_parties"');
    expect(catalog).toContain("Mini festa real Adoce");
  });

  it("permite editar o tipo de evento na operação", () => {
    expect(admin).toContain("Tipo de evento");
    expect(admin).toContain("eventSubcategoryLabels");
    expect(admin).toContain('selectedProduct.segment === "events"');
  });

  it("move o Kit Festa na Mesa sem alterar o produto", () => {
    expect(migration).toContain("where slug = 'festa-na-mesa'");
    expect(migration).toContain("subcategory = 'mini_parties'");
    expect(migration).toContain("set segment = 'events'");
    expect(migration).toContain("subcategory = 'trays'");
    expect(migration).toContain("/adoce-hoje/festas-eventos.webp");
  });
});
