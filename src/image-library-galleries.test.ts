import { describe, expect, it } from "vitest";
import {
  buildGalleryOwners,
  filterGalleryOwners,
  galleryOwnerOutputHeight,
} from "./image-library-galleries";

const owners = buildGalleryOwners({
  flavors: [{ id: "f1", name: "Brigadeiro", active: true }],
  products: [{ id: "p1", name: "Kit Festa", segment: "events", active: true }],
  flavorImages: [{
    id: "fi1",
    flavor_id: "f1",
    image_path: "/brigadeiro.webp",
    original_image_path: null,
    alt_text: "Brigadeiro cremoso",
    caption: "Foto da fatia",
    image_role: "gallery",
    sort_order: 2,
    active: true,
  }],
  commercialMedia: [{
    id: "m1",
    segment: null,
    product_id: "p1",
    media_type: "instagram",
    image_url: null,
    original_image_url: null,
    external_url: "https://www.instagram.com/reel/abc/",
    alt_text: "Vídeo do kit festa",
    caption: "Montagem do evento",
    sort_order: 10,
    active: true,
  }],
  segments: ["events"],
});

describe("inventário central de galerias", () => {
  it("reúne sabores, produtos e categorias na mesma estrutura", () => {
    expect(owners.map((owner) => owner.kind)).toEqual([
      "commercial-segment-gallery",
      "commercial-product-gallery",
      "flavor-gallery",
    ]);
  });

  it("preserva fotos e Reels com seus proprietários", () => {
    expect(owners.find((owner) => owner.ownerId === "f1")?.items[0].imageUrl).toBe("/brigadeiro.webp");
    expect(owners.find((owner) => owner.ownerId === "p1")?.items[0].mediaType).toBe("instagram");
  });

  it("filtra por nome, tipo e situação da galeria", () => {
    expect(filterGalleryOwners(owners, { query: "brigadeiro" })).toHaveLength(1);
    expect(filterGalleryOwners(owners, { kind: "commercial-product-gallery" })).toHaveLength(1);
    expect(filterGalleryOwners(owners, { status: "empty" })).toHaveLength(1);
    expect(filterGalleryOwners(owners, { status: "with-reels" })).toHaveLength(1);
  });

  it("calcula a altura recomendada a partir da proporção", () => {
    const product = owners.find((owner) => owner.ownerId === "p1");
    expect(product && galleryOwnerOutputHeight(product)).toBe(1050);
  });
});
