import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("galerias comerciais", () => {
  const admin = readFileSync(new URL("./OperationCommercialAdmin.tsx", import.meta.url), "utf8");
  const catalog = readFileSync(new URL("./CommercialCatalog.tsx", import.meta.url), "utf8");

  it("permite substituir e reenquadrar uma foto existente", () => {
    expect(admin).toContain("mediaItemId?: string");
    expect(admin).toContain("Foto substituída e reenquadrada na galeria.");
    expect(admin).toContain("onReplace={(item, file)");
  });

  it("não repete a foto da categoria em cada opção de eventos, escola e aluguel", () => {
    expect(catalog).toContain('["events", "school", "rentals"]');
    expect(catalog).toContain("!categoryOnlyMediaSegments.has(segment)");
  });

  it("não permite anexar mídia a um produto ainda não salvo", () => {
    expect(admin).toContain("disabled={busy || !selectedProduct.id}");
    expect(admin).toContain("Salve o produto antes de adicionar fotos ou Reels à galeria.");
  });
});
