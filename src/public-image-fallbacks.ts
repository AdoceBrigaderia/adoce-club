import { IMAGE_PLACEHOLDERS, type ImagePlaceholderKind } from "./image-placeholders";

const LEGACY_GENERIC_IMAGE_PATHS: Partial<Record<string, ImagePlaceholderKind>> = {
  "/adoce-hoje/sabores-hoje.webp": "flavor",
};

export function publicImagePlaceholderKind(altText?: string | null): ImagePlaceholderKind {
  const alt = (altText || "").toLocaleLowerCase("pt-BR");
  if (/torta|bolo inteiro|whole cake/.test(alt)) return "wholeCake";
  if (/fatia|sabor|flavor/.test(alt)) return "flavor";
  if (/campanha|banner|promo[cç][aã]o|arte/.test(alt)) return "campaign";
  return "product";
}

function sourcePathname(source: string) {
  try {
    return new URL(source, "https://adocebrigaderia.com.br").pathname;
  } catch {
    return source;
  }
}

export function resolvePublicImageSource(source?: string | null, altText?: string | null) {
  const normalized = source?.trim() || "";
  const kind = publicImagePlaceholderKind(altText);
  if (!normalized) return IMAGE_PLACEHOLDERS[kind];

  const legacyKind = LEGACY_GENERIC_IMAGE_PATHS[sourcePathname(normalized)];
  if (legacyKind) return IMAGE_PLACEHOLDERS[legacyKind];
  if (normalized.includes("instagram.com/")) return IMAGE_PLACEHOLDERS[kind];

  return normalized;
}

export function fallbackForImageElement(image: HTMLImageElement) {
  const source = image.getAttribute("src");
  return resolvePublicImageSource(source, image.getAttribute("alt"));
}
