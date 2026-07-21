import { describe, expect, it } from "vitest";
import {
  PRODUCT_IMAGE_MAX_BYTES,
  safeMediaFileName,
  validateProductImage,
} from "./admin-media";

describe("mídia do catálogo", () => {
  it("aceita os formatos previstos dentro do limite", () => {
    expect(validateProductImage({ type: "image/jpeg", size: 1000 })).toBe("");
    expect(validateProductImage({ type: "image/webp", size: 1000 })).toBe("");
  });

  it("recusa formato ou tamanho indevido", () => {
    expect(validateProductImage({ type: "image/gif", size: 1000 })).toContain(
      "JPG",
    );
    expect(
      validateProductImage({
        type: "image/png",
        size: PRODUCT_IMAGE_MAX_BYTES + 1,
      }),
    ).toContain("6 MB");
  });

  it("gera nomes seguros para o armazenamento", () => {
    expect(safeMediaFileName("Trufado de Ninho & Morango.jpg")).toBe(
      "trufado-de-ninho-morango-jpg",
    );
  });
});
