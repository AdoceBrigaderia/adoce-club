import { describe, expect, it } from "vitest";
import {
  EDITED_IMAGE_MAX_BYTES,
  validateEditedProductImage,
} from "./admin-media";

function image(
  width: number,
  height: number,
  size = 120_000,
  type = "image/webp",
) {
  return {
    blob: new Blob([new Uint8Array(size)], { type }),
    width,
    height,
  };
}

describe("validação da imagem final antes do upload", () => {
  it("aceita formatos e dimensões padronizados", () => {
    expect(validateEditedProductImage(image(1200, 900))).toBe("");
    expect(validateEditedProductImage(image(1200, 1200))).toBe("");
    expect(validateEditedProductImage(image(1200, 1500))).toBe("");
    expect(validateEditedProductImage(image(1000, 1778))).toBe("");
  });

  it("bloqueia arquivo final vazio", () => {
    expect(validateEditedProductImage(image(1200, 900, 0))).toContain("vazia");
  });

  it("bloqueia formato final diferente de WebP", () => {
    expect(validateEditedProductImage(image(1200, 900, 120_000, "image/png"))).toContain("WebP");
  });

  it("bloqueia arquivo final maior que o limite", () => {
    expect(validateEditedProductImage(image(1200, 900, EDITED_IMAGE_MAX_BYTES + 1))).toContain("750 KB");
  });

  it("bloqueia dimensões muito pequenas ou muito grandes", () => {
    expect(validateEditedProductImage(image(300, 300))).toContain("320 px");
    expect(validateEditedProductImage(image(2500, 1875))).toContain("2400 px");
  });

  it("bloqueia dimensões inválidas", () => {
    expect(validateEditedProductImage(image(1200.5, 900))).toContain("inválidas");
    expect(validateEditedProductImage(image(0, 900))).toContain("inválidas");
  });

  it("bloqueia proporção fora dos formatos aprovados", () => {
    expect(validateEditedProductImage(image(1000, 700))).toContain("proporção");
  });
});
