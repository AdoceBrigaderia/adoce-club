import type { CommercialSegment } from "./commercial";

export type CommercialMediaItem = {
  id: string;
  segment: CommercialSegment | null;
  product_id: string | null;
  media_type: "image" | "instagram";
  image_url: string | null;
  original_image_url: string | null;
  external_url: string | null;
  alt_text: string;
  caption: string;
  sort_order: number;
  active: boolean;
};

export function normalizeInstagramUrl(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (!["instagram.com", "www.instagram.com"].includes(url.hostname.toLowerCase())) return null;
    const match = url.pathname.match(/^\/(reel|p)\/([A-Za-z0-9_-]+)\/?/);
    if (!match) return null;
    return `https://www.instagram.com/${match[1]}/${match[2]}/`;
  } catch {
    return null;
  }
}

export function instagramEmbedUrl(value: string) {
  const normalized = normalizeInstagramUrl(value);
  return normalized ? `${normalized}embed/` : null;
}

export function mediaPoster(item: CommercialMediaItem, fallback?: string | null) {
  return item.image_url || fallback || null;
}
