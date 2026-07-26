import { describe, expect, it } from "vitest";
import { firstSupportedImageFile } from "./image-input-files";

const supported = ["image/jpeg", "image/png", "image/webp"] as const;

describe("seleção de imagem arrastada", () => {
  it("retorna a primeira imagem suportada", () => {
    const files = [
      { type: "application/pdf", name: "cardapio.pdf" },
      { type: "image/png", name: "produto.png" },
      { type: "image/webp", name: "produto.webp" },
    ];

    expect(firstSupportedImageFile(files, supported)).toEqual(files[1]);
  });

  it("retorna nulo quando não há imagem válida", () => {
    expect(firstSupportedImageFile([], supported)).toBeNull();
    expect(firstSupportedImageFile([
      { type: "image/gif" },
      { type: "application/pdf" },
    ], supported)).toBeNull();
  });

  it("aceita estruturas ArrayLike usadas pelo navegador", () => {
    const files = {
      0: { type: "image/jpeg", name: "fatia.jpg" },
      length: 1,
    };

    expect(firstSupportedImageFile(files, supported)).toEqual(files[0]);
  });
});
