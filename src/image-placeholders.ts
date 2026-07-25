import type { CommercialProduct } from "./commercial";

export const IMAGE_PLACEHOLDERS = {
  flavor: "/site/placeholder-sabor-sem-foto.svg",
  wholeCake: "/site/placeholder-torta-sem-foto.svg",
  product: "/site/placeholder-produto-sem-foto.svg",
  campaign: "/site/placeholder-campanha-sem-arte.svg",
} as const;

export type ImagePlaceholderKind = keyof typeof IMAGE_PLACEHOLDERS;

export function flavorImageOrPlaceholder(imagePath?: string | null) {
  return imagePath?.trim() || IMAGE_PLACEHOLDERS.flavor;
}

export function wholeCakeImageOrPlaceholder(imagePath?: string | null) {
  return imagePath?.trim() || IMAGE_PLACEHOLDERS.wholeCake;
}

export function commercialProductImageOrPlaceholder(product: Pick<CommercialProduct, "image_url" | "slug" | "segment">) {
  const imageUrl = product.image_url?.trim();
  if (imageUrl && !imageUrl.includes("instagram.com/")) return imageUrl;
  if (product.slug === "docinhos-tradicionais") return "/adoce-hoje/docinhos-tradicionais.webp";
  if (product.slug === "docinhos-especiais") return "/adoce-hoje/docinhos-premium.webp";
  return product.segment === "cakes" ? IMAGE_PLACEHOLDERS.wholeCake : IMAGE_PLACEHOLDERS.product;
}
