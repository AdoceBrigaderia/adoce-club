import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  new URL("../supabase/seeds/homologation/20260729_real_cake_builder_catalog.sql", import.meta.url),
  "utf8",
);

describe("catálogo real do montador de tortas", () => {
  it("usa somente as tortas reais publicadas e o cadastro comercial existente", () => {
    expect(seed).toContain("product.slug in ('torta-p', 'torta-m', 'torta-g')");
    expect(seed).toContain("product.details->'choices'->'massas'");
    expect(seed).toContain("product.details->'choices'->'recheios'");
    expect(seed).not.toContain("insert into public.commercial_products");
    expect(seed).not.toContain("uefwywizqhfvvijaopcn");
  });

  it("preserva a estrutura real de uma massa e dois recheios", () => {
    expect(seed).toContain("cake_layers");
    expect(seed).toContain("filling_layers");
    expect(seed).toMatch(/3,\s*2,\s*false,\s*true,/);
    expect(seed).toContain("template.allow_mixed_cake_layers = false");
    expect(seed).toContain("template.allow_mixed_fillings = true");
  });

  it("cria somente um acabamento neutro e não inventa frutas ou adicionais", () => {
    expect(seed).toContain("'acabamento-padrao-adoce'");
    expect(seed).toContain("'Acabamento padrão da Adoce'");
    expect(seed).toContain("A finalização visual será confirmada no atendimento");
    expect(seed).not.toMatch(/'filling_fruit'|'topping_fruit'|'filling_extra'|'topping_extra'/);
  });

  it("não inventa custo nem acréscimo", () => {
    expect(seed).toContain("'manual_provisional'");
    expect(seed).toContain("custo técnico e eventual acréscimo ainda aguardam validação");
    expect(seed).toContain("Material, acabamento e custo técnico aguardam validação");
    expect(seed).not.toMatch(/price_adjustment,\s*[1-9]/);
    expect(seed).not.toMatch(/unit_cost,\s*[1-9]/);
  });

  it("é idempotente, transacional e valida os três templates", () => {
    expect(seed.trimStart()).toMatch(/^begin;/);
    expect(seed.trimEnd()).toMatch(/commit;$/);
    expect(seed).toContain("on conflict (product_id) do update");
    expect(seed).toContain("on conflict (template_id, placement, slug) do update");
    expect(seed).toContain("Esperadas 3 tortas reais publicadas");
    expect(seed).toContain("valid_templates <> 3");
    expect(seed).not.toMatch(/truncate|drop table|delete from/i);
  });
});
