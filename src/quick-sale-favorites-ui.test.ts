import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(new URL("./OperationManualSale.tsx", import.meta.url), "utf8");
const styles = readFileSync(
  new URL("./operation-quick-sale-ranking.css", import.meta.url),
  "utf8",
);
const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("atalhos de favoritos e mais vendidos na venda rápida", () => {
  it("mantém o catálogo ordenado no backend e oferece filtros grandes no tablet", () => {
    expect(panel).toContain('type CatalogView = "all" | "favorites" | "popular"');
    expect(panel).toContain("Favoritos ({favoritesCount})");
    expect(panel).toContain("Mais vendidos ({popularCount})");
    expect(panel).toContain("sales_count_30d");
    expect(styles).toContain("min-height: 48px");
    expect(styles).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
  });

  it("permite favoritar sem desviar a venda para acesso direto ao banco", () => {
    expect(panel).toContain('bffRpc("staff_set_quick_sale_favorite"');
    expect(panel).toContain("aria-pressed={flavor.is_favorite}");
    expect(panel).not.toContain("requireSupabase");
    expect(panel).not.toContain("auth.getSession");
    expect(policy).toContain('"staff_set_quick_sale_favorite"');
  });

  it("preserva a conclusão única e os controles de quantidade", () => {
    expect(panel).toContain("onClick={() => setQuantity(flavor, quantity + 1)}");
    expect(panel).toContain("Registrar venda · ${money(total)}");
    expect(panel).toContain("staff_create_manual_sale_in_cash");
  });
});
