import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("preço da fatia aplicado a todos os sabores de uma vez", () => {
  it("existe uma tela única em Configurações para fatia e tortas P/M/G", () => {
    const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
    expect(access).toContain('const PricingSettings = lazy(() => import("./PricingSettings"));');
    expect(access).toContain("<PricingSettings />");
  });

  it("aplicar a fatia chama a RPC que atualiza todos os sabores ativos de uma vez, com confirmação", () => {
    const pricing = readFileSync(new URL("./PricingSettings.tsx", import.meta.url), "utf8");
    expect(pricing).toContain("manager_bulk_set_flavor_price");
    expect(pricing).toContain("confirmAction(");
    expect(pricing).toContain("requested_price: value");
  });

  it("a RPC recusa preço inválido e fica restrita a proprietário/gerente", () => {
    const migration = readFileSync(
      new URL("../supabase/migrations/20261103084117_bulk_set_flavor_price.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("private.is_manager()");
    expect(migration).toContain("requested_price <= 0");
    expect(migration).toContain("update public.flavors");
    expect(migration).toContain("set base_price = requested_price");
    expect(migration).toContain("where active = true");
  });

  it("não cria coluna nova nem duplica o preço -- escreve direto em flavors.base_price", () => {
    const migration = readFileSync(
      new URL("../supabase/migrations/20261103084117_bulk_set_flavor_price.sql", import.meta.url),
      "utf8",
    );
    expect(migration).not.toContain("add column");
    expect(migration).not.toContain("create table");
  });

  it("tortas P/M/G têm fonte única em commercial_products, editável na mesma tela", () => {
    const pricing = readFileSync(new URL("./PricingSettings.tsx", import.meta.url), "utf8");
    expect(pricing).toContain('slug: "torta-p"');
    expect(pricing).toContain('slug: "torta-m"');
    expect(pricing).toContain('slug: "torta-g"');
    expect(pricing).toContain('from("commercial_products").update({ base_price: item.value }).eq("slug"');
  });

  it("o catálogo de encomendas (/catalogo) busca o preço de P/M/G no banco em vez de usar texto fixo", () => {
    // Pedido do proprietário em 03/11/2026: antes os preços de P/M/G em
    // CatalogPage2026.tsx eram só texto digitado, sem nenhuma fonte -- quem
    // mudasse o preço em Configurações não via efeito nenhum nessa página.
    const catalog = readFileSync(new URL("./CatalogPage2026.tsx", import.meta.url), "utf8");
    expect(catalog).toContain('from("commercial_products")');
    expect(catalog).toContain('.select("slug,base_price")');
    expect(catalog).toContain("livePrices[size.slug] || size.price");
  });
});
