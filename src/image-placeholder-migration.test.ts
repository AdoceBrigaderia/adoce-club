import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260725213624_central_image_placeholders.sql", import.meta.url),
  "utf8",
);

describe("migração de placeholders de imagens", () => {
  it("define placeholders específicos e determinísticos", () => {
    expect(migration).toContain("placeholder-sabor-sem-foto.svg");
    expect(migration).toContain("placeholder-torta-sem-foto.svg");
    expect(migration).toContain("placeholder-produto-sem-foto.svg");
    expect(migration).toContain("new.segment = 'cakes'");
  });

  it("não utiliza banners comerciais como imagem automática", () => {
    expect(migration).not.toContain("festas-eventos.webp");
    expect(migration).not.toContain("sabores-hoje.webp");
    expect(migration).not.toContain("random(");
  });
});
