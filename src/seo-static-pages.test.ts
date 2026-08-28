import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

describe("paginas publicas para busca", () => {
  it("mantem o fallback de rotas sem engolir documentacao e 404 explicita", () => {
    const netlify = read("../netlify.toml").replace(/\r\n/g, "\n");
    expect(netlify).toContain('from = "/documentacao"');
    expect(netlify).toContain('from = "/404"');
    expect(netlify).toContain('from = "/*"\n  to = "/index.html"\n  status = 200');
  });

  it("gera paginas depois do bundle e preserva links antigos", () => {
    const pkg = JSON.parse(read("../package.json"));
    const main = read("./main.tsx");
    expect(pkg.scripts.build).toContain("node scripts/generate-seo-pages.mjs");
    expect(read("../scripts/generate-seo-pages.mjs")).toContain('`${relative}.html`');
    expect(main).toContain('window.location.hash === "#sabores"');
    expect(main).toContain("/^#sabores(?:\\/|\\?(?:slug|sabor)=)");
    expect(main).toContain('[data-seo-static-page]');
  });

  it("guarda o slug no banco sem mudar por edicao posterior do nome", () => {
    const migration = read("../supabase/migrations/20260812043651_flavor_seo_slugs.sql");
    expect(migration).toContain("add column if not exists slug text");
    expect(migration).toContain("before insert on public.flavors");
    expect(migration).not.toContain("before insert or update");
    expect(migration).toContain("trufado-de-ninho-com-morangos");
    expect(migration).toContain("create unique index if not exists flavors_slug_key");
  });

  it("permite que a equipe gere o slug ao cadastrar um sabor", () => {
    const migration = read(
      "../supabase/migrations/20260814182357_restore_flavor_slug_trigger_permission.sql",
    );
    expect(migration).toContain(
      "grant execute on function private.flavor_slug_from_name(text)",
    );
    expect(migration).toContain("to authenticated, service_role");
    expect(migration).toContain("from public, anon, authenticated, service_role");
  });

  it("nao inventa disponibilidade nem horario", () => {
    const generator = read("../scripts/generate-seo-pages.mjs");
    expect(generator).toContain('service_date=eq.${today}');
    expect(generator).toContain('row.channel_slug === "in_person"');
    expect(generator).toContain('if (flavor.availability)');
    expect(generator).not.toContain('availability: "https://schema.org/InStock"');
  });

  it("aceita novos sabores sem publicar um catalogo incompleto", () => {
    const generator = read("../scripts/generate-seo-pages.mjs");
    expect(generator).toContain("flavors.length < MINIMUM_PUBLIC_FLAVORS");
    expect(generator).toContain("${catalog.length} sabores");
    expect(generator).not.toContain("flavors.length !== 26");
  });
});
