import { describe, expect, it } from "vitest";
import {
  IMAGE_PLACEHOLDERS,
  commercialProductImageOrPlaceholder,
  flavorImageOrPlaceholder,
  wholeCakeImageOrPlaceholder,
} from "./image-placeholders";

describe("placeholders padronizados de imagens", () => {
  it("usa um placeholder honesto para sabor sem foto", () => {
    expect(flavorImageOrPlaceholder(null)).toBe(IMAGE_PLACEHOLDERS.flavor);
    expect(flavorImageOrPlaceholder("  ")).toBe(IMAGE_PLACEHOLDERS.flavor);
  });

  it("usa um placeholder específico para torta inteira", () => {
    expect(wholeCakeImageOrPlaceholder(undefined)).toBe(IMAGE_PLACEHOLDERS.wholeCake);
  });

  it("preserva uma foto oficial cadastrada", () => {
    expect(commercialProductImageOrPlaceholder({
      image_url: "https://cdn.exemplo.com/produto.webp",
      slug: "produto-real",
      segment: "sweets",
    })).toBe("https://cdn.exemplo.com/produto.webp");
  });

  it("não herda banner aleatório quando um produto nasce sem foto", () => {
    expect(commercialProductImageOrPlaceholder({
      image_url: null,
      slug: "produto-novo",
      segment: "events",
    })).toBe(IMAGE_PLACEHOLDERS.product);
  });

  it("diferencia tortas dos demais produtos sem foto", () => {
    expect(commercialProductImageOrPlaceholder({
      image_url: null,
      slug: "torta-nova",
      segment: "cakes",
    })).toBe(IMAGE_PLACEHOLDERS.wholeCake);
  });
});
