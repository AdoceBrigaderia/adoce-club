import type { GalleryImageItem, GalleryOwner } from "./image-library-galleries";

export type GalleryMediaVersionKind =
  | "flavor-image"
  | "commercial-image"
  | "commercial-instagram";

export type GalleryMediaVersionChangeType = "created" | "updated" | "deleted";

export type GalleryMediaVersion = {
  id: string;
  media_key: string;
  media_kind: GalleryMediaVersionKind;
  media_id: string;
  owner_kind: GalleryOwner["kind"];
  owner_id: string;
  label: string;
  media_type: GalleryImageItem["mediaType"];
  image_url: string | null;
  original_image_url: string | null;
  external_url: string | null;
  alt_text: string;
  caption: string;
  role: string | null;
  sort_order: number;
  active: boolean;
  change_type: GalleryMediaVersionChangeType;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: string;
};

type FlavorMediaRestorePlan = {
  table: "flavor_images";
  matchColumn: "id";
  matchValue: string;
  values: {
    image_path: string;
    original_image_path: string | null;
    alt_text: string;
    caption: string;
    image_role: string;
    sort_order: number;
    active: true;
  };
};

type CommercialMediaRestorePlan = {
  table: "commercial_media_items";
  matchColumn: "id";
  matchValue: string;
  values: {
    segment: string | null;
    product_id: string | null;
    media_type: GalleryImageItem["mediaType"];
    image_url: string | null;
    original_image_url: string | null;
    external_url: string | null;
    alt_text: string;
    caption: string;
    sort_order: number;
    active: true;
    updated_by: string;
  };
};

export type GalleryMediaRestorePlan = FlavorMediaRestorePlan | CommercialMediaRestorePlan;

const CHANGE_LABELS: Record<GalleryMediaVersionChangeType, string> = {
  created: "Mídia cadastrada",
  updated: "Mídia alterada",
  deleted: "Mídia removida",
};

export function galleryMediaKey(owner: Pick<GalleryOwner, "kind">, itemId: string) {
  return owner.kind === "flavor-gallery"
    ? `flavor-media:${itemId}`
    : `commercial-media:${itemId}`;
}

export function galleryMediaChangeLabel(changeType: GalleryMediaVersionChangeType) {
  return CHANGE_LABELS[changeType];
}

export function galleryMediaVersionDate(value: string, locale = "pt-BR") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function galleryMediaVersionSource(version: GalleryMediaVersion) {
  return version.media_type === "instagram" ? version.external_url : version.image_url;
}

export function galleryMediaVersionIsCurrent(
  version: GalleryMediaVersion,
  item: Pick<GalleryImageItem, "mediaType" | "imageUrl" | "externalUrl">,
) {
  if (!version.active || version.media_type !== item.mediaType) return false;
  const currentSource = item.mediaType === "instagram" ? item.externalUrl : item.imageUrl;
  return Boolean(currentSource) && galleryMediaVersionSource(version) === currentSource;
}

export function galleryMediaRestorePlan(
  owner: GalleryOwner,
  item: GalleryImageItem,
  version: GalleryMediaVersion,
  userId: string,
): GalleryMediaRestorePlan {
  if (
    version.media_id !== item.id
    || version.owner_kind !== owner.kind
    || version.owner_id !== owner.ownerId
  ) {
    throw new Error("A versão selecionada não pertence a esta mídia.");
  }

  if (owner.kind === "flavor-gallery") {
    if (version.media_type !== "image" || !version.image_url) {
      throw new Error("A galeria de sabores aceita apenas versões de imagem.");
    }
    return {
      table: "flavor_images",
      matchColumn: "id",
      matchValue: item.id,
      values: {
        image_path: version.image_url,
        original_image_path: version.original_image_url,
        alt_text: version.alt_text,
        caption: version.caption,
        image_role: version.role || "gallery",
        sort_order: version.sort_order,
        active: true,
      },
    };
  }

  return {
    table: "commercial_media_items",
    matchColumn: "id",
    matchValue: item.id,
    values: {
      segment: owner.kind === "commercial-segment-gallery" ? owner.ownerId : null,
      product_id: owner.kind === "commercial-product-gallery" ? owner.ownerId : null,
      media_type: version.media_type,
      image_url: version.image_url,
      original_image_url: version.original_image_url,
      external_url: version.external_url,
      alt_text: version.alt_text,
      caption: version.caption,
      sort_order: version.sort_order,
      active: true,
      updated_by: userId,
    },
  };
}
