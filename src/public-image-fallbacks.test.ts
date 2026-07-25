import { describe, expect, it } from "vitest";
import { IMAGE_PLACEHOLDERS } from "./image-placeholders";
import { mediaPoster, type CommercialMediaItem } from "./commercial-media";
import { publicImagePlaceholderKind, resolvePublicImageSource } from "./public-image-fallbacks";

const emptyMedia = (altText: string): CommercialMediaItem => ({
  id: "media-test",
  segment: null,
  product_id: null,
  media_type: "image",
  image_url: null,
  original_image_url: null,
  external_url: null,
  alt_text: altText,
  caption: "",
  sort_order: 0,
  active: true,
});

describe("fallback global de imagens públicas", () => {
  it("escolhe placeholder pelo contexto apresentado ao cliente", () => {
    expect(publicImagePlaceholderKind("Fatia de chocolate")).toBe("flavor");
    expect(publicImagePlaceholderKind("Torta inteira de Ninho")).toBe("wholeCake");
    expect(publicImagePlaceholderKind("Banner da campanha de julho")).toBe("campaign");
    expect(publicImagePlaceholderKind("Foto do produto")).toBe("product");
  });

  it("substitui a arte genérica antiga de sabores pelo placeholder honesto", () => {
    expect(resolvePublicImageSource("/adoce-hoje/sabores-hoje.webp", "Sabor novo")).toBe(
      IMAGE_PLACEHOLDERS.flavor,
    );
  });

  it("preserva uma foto oficial válida", () => {
    expect(resolvePublicImageSource("https://cdn.exemplo.com/fatia.webp", "Fatia oficial")).toBe(
      "https://cdn.exemplo.com/fatia.webp",
    );
  });

  it("não usa URL do Instagram como imagem direta", () => {
    expect(resolvePublicImageSource("https://www.instagram.com/p/abc/", "Produto sem foto")).toBe(
      IMAGE_PLACEHOLDERS.product,
    );
  });

  it("fornece placeholder contextual quando a mídia comercial está vazia", () => {
    expect(mediaPoster(emptyMedia("Torta inteira"), null)).toBe(IMAGE_PLACEHOLDERS.wholeCake);
    expect(mediaPoster(emptyMedia("Produto"), null)).toBe(IMAGE_PLACEHOLDERS.product);
  });
});
