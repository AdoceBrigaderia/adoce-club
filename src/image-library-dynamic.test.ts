import { describe, expect, it } from "vitest";
import { buildDynamicImageAssets, dynamicImageOutputHeight } from "./image-library-dynamic";
import { IMAGE_PLACEHOLDERS } from "./image-placeholders";

describe("biblioteca dinâmica de imagens", () => {
  const assets = buildDynamicImageAssets({
    flavors: [
      {
        id: "flavor-1",
        name: "Chocolate",
        image_path: null,
        whole_cake_image_path: null,
        whole_cake_original_image_path: null,
        whole_cake_available: true,
        active: true,
      },
      {
        id: "flavor-inactive",
        name: "Inativo",
        image_path: null,
        whole_cake_image_path: null,
        whole_cake_original_image_path: null,
        whole_cake_available: false,
        active: false,
      },
    ],
    products: [
      {
        id: "product-1",
        name: "Caixa presente",
        segment: "gifts",
        image_url: null,
        original_image_url: null,
        active: true,
      },
      {
        id: "cake-1",
        name: "Torta especial",
        segment: "cakes",
        image_url: null,
        original_image_url: null,
        active: true,
      },
    ],
    segments: [
      {
        segment: "gifts",
        image_url: "",
        original_image_url: null,
      },
    ],
  });

  it("reúne capas de sabores, tortas, produtos e categorias", () => {
    expect(assets).toHaveLength(5);
    expect(assets.map((item) => item.kind)).toEqual(expect.arrayContaining([
      "flavor-cover",
      "whole-cake",
      "commercial-product",
      "commercial-segment",
    ]));
  });

  it("ignora sabores e produtos inativos", () => {
    expect(assets.some((item) => item.ownerId === "flavor-inactive")).toBe(false);
  });

  it("usa o placeholder correto para cada contexto", () => {
    expect(assets.find((item) => item.kind === "flavor-cover")?.currentUrl)
      .toBe(IMAGE_PLACEHOLDERS.flavor);
    expect(assets.find((item) => item.kind === "whole-cake")?.currentUrl)
      .toBe(IMAGE_PLACEHOLDERS.wholeCake);
    expect(assets.find((item) => item.ownerId === "cake-1")?.currentUrl)
      .toBe(IMAGE_PLACEHOLDERS.wholeCake);
    expect(assets.find((item) => item.ownerId === "product-1")?.currentUrl)
      .toBe(IMAGE_PLACEHOLDERS.product);
  });

  it("calcula a dimensão recomendada sem arredondamento inconsistente", () => {
    expect(dynamicImageOutputHeight({ outputWidth: 1400, aspectWidth: 4, aspectHeight: 3 }))
      .toBe(1050);
  });
});
