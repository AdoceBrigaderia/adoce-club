import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const admin = readFileSync(
  new URL("./OperationContentAdmin.tsx", import.meta.url),
  "utf8",
);

describe("fotos de sabores na Central Adoce", () => {
  it("salva foto principal, galeria e torta inteira pelas funções seguras", () => {
    expect(admin).toContain('"manager_save_gallery_media_asset"');
    expect(admin).toContain('"manager_save_dynamic_image_asset"');
    expect(admin).toContain('requested_asset_kind: "flavor-cover"');
    expect(admin).toContain('requested_asset_kind: "whole-cake"');
    expect(admin).toContain('requested_owner_kind: "flavor-gallery"');
  });

  it("remove fotos pela função segura em vez de alterar a tabela diretamente", () => {
    expect(admin).toContain('"manager_disable_gallery_media"');
    expect(admin).not.toMatch(
      /from\("flavor_images"\)[\s\S]{0,100}\.update\(\{ active: false \}\)/,
    );
  });
});
