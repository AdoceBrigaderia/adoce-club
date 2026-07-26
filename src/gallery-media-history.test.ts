import { describe, expect, it } from "vitest";
import {
  galleryMediaChangeLabel,
  galleryMediaKey,
  galleryMediaRestorePlan,
  galleryMediaVersionIsCurrent,
  galleryMediaVersionSource,
  type GalleryMediaVersion,
} from "./gallery-media-history";
import type { GalleryImageItem, GalleryOwner } from "./image-library-galleries";

const item: GalleryImageItem = {
  id: "media-1",
  mediaType: "image",
  imageUrl: "/site/atual.webp",
  originalUrl: "/site/atual-original.webp",
  externalUrl: null,
  alt: "Imagem atual",
  caption: "Atual",
  sortOrder: 10,
  role: "gallery",
};

const flavorOwner: GalleryOwner = {
  id: "flavor-gallery:flavor-1",
  kind: "flavor-gallery",
  ownerId: "flavor-1",
  label: "Chocolate",
  section: "Galerias de sabores e fatias",
  description: "Galeria",
  aspectWidth: 1,
  aspectHeight: 1,
  outputWidth: 1200,
  acceptedFormats: "JPG, PNG ou WebP",
  storageFolder: "produtos/flavor-1",
  items: [item],
};

const imageVersion: GalleryMediaVersion = {
  id: "version-1",
  media_key: "flavor-media:media-1",
  media_kind: "flavor-image",
  media_id: "media-1",
  owner_kind: "flavor-gallery",
  owner_id: "flavor-1",
  label: "Sabor: Chocolate",
  media_type: "image",
  image_url: "/site/anterior.webp",
  original_image_url: "/site/anterior-original.webp",
  external_url: null,
  alt_text: "Imagem anterior",
  caption: "Anterior",
  role: "gallery",
  sort_order: 20,
  active: true,
  change_type: "updated",
  changed_by: null,
  changed_by_name: "Gestor",
  changed_at: "2026-07-26T08:00:00Z",
};

describe("histórico de galerias e carrosséis", () => {
  it("gera chaves estáveis por origem da mídia", () => {
    expect(galleryMediaKey(flavorOwner, item.id)).toBe("flavor-media:media-1");
    expect(galleryMediaKey({ ...flavorOwner, kind: "commercial-product-gallery" }, item.id))
      .toBe("commercial-media:media-1");
  });

  it("descreve os tipos de alteração", () => {
    expect(galleryMediaChangeLabel("created")).toBe("Mídia cadastrada");
    expect(galleryMediaChangeLabel("updated")).toBe("Mídia alterada");
    expect(galleryMediaChangeLabel("deleted")).toBe("Mídia removida");
  });

  it("resolve a fonte correta para imagens e Reels", () => {
    expect(galleryMediaVersionSource(imageVersion)).toBe("/site/anterior.webp");
    expect(galleryMediaVersionSource({
      ...imageVersion,
      media_kind: "commercial-instagram",
      media_type: "instagram",
      image_url: null,
      external_url: "https://www.instagram.com/reel/exemplo/",
    })).toBe("https://www.instagram.com/reel/exemplo/");
  });

  it("identifica somente a versão ativa que corresponde à mídia atual", () => {
    expect(galleryMediaVersionIsCurrent(
      { ...imageVersion, image_url: "/site/atual.webp" },
      item,
    )).toBe(true);
    expect(galleryMediaVersionIsCurrent(
      { ...imageVersion, image_url: "/site/atual.webp", active: false },
      item,
    )).toBe(false);
  });

  it("restaura todos os atributos de uma foto de sabor", () => {
    expect(galleryMediaRestorePlan(flavorOwner, item, imageVersion, "user-1")).toEqual({
      table: "flavor_images",
      matchColumn: "id",
      matchValue: "media-1",
      values: {
        image_path: "/site/anterior.webp",
        original_image_path: "/site/anterior-original.webp",
        alt_text: "Imagem anterior",
        caption: "Anterior",
        image_role: "gallery",
        sort_order: 20,
        active: true,
      },
    });
  });

  it("restaura foto ou Reel comercial no proprietário correto", () => {
    const owner: GalleryOwner = {
      ...flavorOwner,
      id: "commercial-product-gallery:product-1",
      kind: "commercial-product-gallery",
      ownerId: "product-1",
    };
    const version: GalleryMediaVersion = {
      ...imageVersion,
      media_key: "commercial-media:media-1",
      media_kind: "commercial-image",
      owner_kind: "commercial-product-gallery",
      owner_id: "product-1",
    };
    expect(galleryMediaRestorePlan(owner, item, version, "user-1")).toMatchObject({
      table: "commercial_media_items",
      matchValue: "media-1",
      values: {
        segment: null,
        product_id: "product-1",
        active: true,
        updated_by: "user-1",
      },
    });
  });

  it("bloqueia versão pertencente a outro item", () => {
    expect(() => galleryMediaRestorePlan(
      flavorOwner,
      item,
      { ...imageVersion, media_id: "media-2" },
      "user-1",
    )).toThrow("A versão selecionada não pertence a esta mídia.");
  });
});
