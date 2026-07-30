import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727034403_quick_sale_favorites_and_ranking.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("favoritos e ranking da venda rápida", () => {
  it("mantém favoritos privados e fora do acesso direto do navegador", () => {
    expect(migration).toContain(
      "create table if not exists public.staff_quick_sale_favorites",
    );
    expect(migration).toContain(
      "alter table public.staff_quick_sale_favorites enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.staff_quick_sale_favorites from public, anon, authenticated/,
    );
  });

  it("permite somente equipe com capacidade de venda alterar seus favoritos", () => {
    expect(migration).toContain(
      "create or replace function public.staff_set_quick_sale_favorite",
    );
    expect(migration).toContain("private.staff_has_any_capability('sell')");
    expect(migration).toContain("staff_profile_id = current_profile_id");
    expect(migration).toContain("on conflict (staff_profile_id, flavor_id) do nothing");
    expect(migration).toMatch(
      /revoke all on function public\.staff_set_quick_sale_favorite\(uuid,boolean\)[\s\S]*from public, anon/,
    );
  });

  it("calcula popularidade no servidor e ordena o catálogo antes de chegar ao tablet", () => {
    expect(migration).toContain("with sales_30d as");
    expect(migration).toContain("sum(item.quantity)");
    expect(migration).toContain("orders.created_at >= now() - interval '30 days'");
    expect(migration).toContain("'is_favorite', item.is_favorite");
    expect(migration).toContain("'sales_count_30d', item.sales_count_30d");
    expect(migration).toMatch(
      /order by\s+item\.is_favorite desc,\s+item\.sales_count_30d desc,\s+item\.name/,
    );
  });
});
