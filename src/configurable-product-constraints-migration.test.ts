import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260728221500_configurable_product_constraints.sql", import.meta.url),
  "utf8",
);

describe("restrições finais dos produtos configuráveis", () => {
  it("adiciona o segmento de biscoitos sem remover os segmentos existentes", () => {
    for (const segment of ["cakes", "sweets", "events", "school", "rentals", "cookies"]) {
      expect(migration).toContain(`'${segment}'`);
    }
    expect(migration).toContain("commercial_products_segment_check");
  });

  it("impede combinações incompatíveis entre tipo e montador", () => {
    expect(migration).toContain("product_type = 'cake' and customization_mode = 'cake_builder'");
    expect(migration).toContain("product_type in ('sweet','cookie','school_kit') and customization_mode in ('none','option_groups')");
    expect(migration).toContain("product_type = 'fixed' and customization_mode = 'none'");
  });

  it("não executa alteração produtiva ou comando destrutivo", () => {
    expect(migration).not.toContain("uefwywizqhfvvijaopcn");
    expect(migration).not.toMatch(/drop table|truncate|delete from/i);
    expect(migration.trim().startsWith("begin;")).toBe(true);
    expect(migration.trim().endsWith("commit;")).toBe(true);
  });
});
