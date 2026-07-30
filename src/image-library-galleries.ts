export type GalleryOwnerKind =
  | "flavor-gallery"
  | "commercial-product-gallery"
  | "commercial-segment-gallery";

export type FlavorGalleryOwnerRow = {
  id: string;
  name: string;
  active: boolean;
};

export type CommercialGalleryProductRow = {
  id: string;
  name: string;
  segment: string;
  active: boolean;
};

export type FlavorGalleryImageRow = {
  id: string;
  flavor_id: string;
  image_path: string;
  original_image_path: string | null;
  alt_text: string;
  caption: string | null;
  image_role: string;
  sort_order: number;
  active: boolean;
};

export type CommercialGalleryMediaRow = {
  id: string;
  segment: string | null;
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

export type GalleryImageItem = {
  id: string;
  mediaType: "image" | "instagram";
  imageUrl: string | null;
  originalUrl: string | null;
  externalUrl: string | null;
  alt: string;
  caption: string;
  sortOrder: number;
  role?: string;
};

export type GalleryOwner = {
  id: string;
  kind: GalleryOwnerKind;
  ownerId: string;
  label: string;
  section: string;
  description: string;
  aspectWidth: number;
  aspectHeight: number;
  outputWidth: number;
  acceptedFormats: string;
  storageFolder: string;
  items: GalleryImageItem[];
  segment?: string;
};

export type GalleryOwnerFilter = {
  query?: string;
  kind?: "all" | GalleryOwnerKind;
  status?: "all" | "empty" | "with-images" | "with-reels";
};

export const COMMERCIAL_GALLERY_SEGMENTS = [
  "cakes",
  "sweets",
  "events",
  "school",
  "rentals",
] as const;

const segmentLabels: Record<string, string> = {
  cakes: "Tortas inteiras",
  sweets: "Doces e sobremesas",
  events: "Eventos e encomendas",
  school: "Linha escolar",
  rentals: "Locações",
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function sortedItems(items: GalleryImageItem[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function galleryOwnerOutputHeight(
  owner: Pick<GalleryOwner, "outputWidth" | "aspectWidth" | "aspectHeight">,
) {
  return Math.round(owner.outputWidth * owner.aspectHeight / owner.aspectWidth);
}

export function buildGalleryOwners({
  flavors,
  products,
  flavorImages,
  commercialMedia,
  segments = COMMERCIAL_GALLERY_SEGMENTS,
}: {
  flavors: FlavorGalleryOwnerRow[];
  products: CommercialGalleryProductRow[];
  flavorImages: FlavorGalleryImageRow[];
  commercialMedia: CommercialGalleryMediaRow[];
  segments?: readonly string[];
}) {
  const owners: GalleryOwner[] = [];

  flavors.filter((flavor) => flavor.active).forEach((flavor) => {
    const items = flavorImages
      .filter((image) => image.active && image.flavor_id === flavor.id)
      .map<GalleryImageItem>((image) => ({
        id: image.id,
        mediaType: "image",
        imageUrl: image.image_path,
        originalUrl: image.original_image_path,
        externalUrl: null,
        alt: image.alt_text,
        caption: image.caption || "",
        sortOrder: image.sort_order,
        role: image.image_role,
      }));

    owners.push({
      id: `flavor-gallery:${flavor.id}`,
      kind: "flavor-gallery",
      ownerId: flavor.id,
      label: flavor.name,
      section: "Galerias de sabores e fatias",
      description: "Fotos adicionais apresentadas no detalhe do sabor e no Adoce Hoje.",
      aspectWidth: 1,
      aspectHeight: 1,
      outputWidth: 1200,
      acceptedFormats: "JPG, PNG ou WebP",
      storageFolder: `produtos/${flavor.id}`,
      items: sortedItems(items),
    });
  });

  products.filter((product) => product.active).forEach((product) => {
    const items = commercialMedia
      .filter((item) => item.active && item.product_id === product.id)
      .map<GalleryImageItem>((item) => ({
        id: item.id,
        mediaType: item.media_type,
        imageUrl: item.image_url,
        originalUrl: item.original_image_url,
        externalUrl: item.external_url,
        alt: item.alt_text,
        caption: item.caption,
        sortOrder: item.sort_order,
      }));

    owners.push({
      id: `commercial-product-gallery:${product.id}`,
      kind: "commercial-product-gallery",
      ownerId: product.id,
      label: product.name,
      section: "Carrosséis de produtos e serviços",
      description: "Fotos e Reels adicionais exibidos no catálogo comercial.",
      aspectWidth: 4,
      aspectHeight: 3,
      outputWidth: 1400,
      acceptedFormats: "JPG, PNG ou WebP",
      storageFolder: `commercial/galleries/${product.id}`,
      items: sortedItems(items),
      segment: product.segment,
    });
  });

  segments.forEach((segment) => {
    const label = segmentLabels[segment] || segment;
    const items = commercialMedia
      .filter((item) => item.active && item.segment === segment)
      .map<GalleryImageItem>((item) => ({
        id: item.id,
        mediaType: item.media_type,
        imageUrl: item.image_url,
        originalUrl: item.original_image_url,
        externalUrl: item.external_url,
        alt: item.alt_text,
        caption: item.caption,
        sortOrder: item.sort_order,
      }));

    owners.push({
      id: `commercial-segment-gallery:${segment}`,
      kind: "commercial-segment-gallery",
      ownerId: segment,
      label: `Categoria — ${label}`,
      section: "Carrosséis de categorias",
      description: "Galeria geral da categoria, usada antes de o cliente abrir um produto.",
      aspectWidth: 4,
      aspectHeight: 3,
      outputWidth: 1600,
      acceptedFormats: "JPG, PNG ou WebP",
      storageFolder: `commercial/galleries/${segment}`,
      items: sortedItems(items),
      segment,
    });
  });

  return owners.sort(
    (a, b) => a.section.localeCompare(b.section, "pt-BR")
      || a.label.localeCompare(b.label, "pt-BR"),
  );
}

export function filterGalleryOwners(
  owners: GalleryOwner[],
  {
    query = "",
    kind = "all",
    status = "all",
  }: GalleryOwnerFilter = {},
) {
  const normalizedQuery = normalizeSearch(query);

  return owners.filter((owner) => {
    if (kind !== "all" && owner.kind !== kind) return false;
    if (status === "empty" && owner.items.length !== 0) return false;
    if (status === "with-images" && !owner.items.some((item) => item.mediaType === "image")) return false;
    if (status === "with-reels" && !owner.items.some((item) => item.mediaType === "instagram")) return false;
    if (!normalizedQuery) return true;

    const searchable = normalizeSearch([
      owner.label,
      owner.section,
      owner.description,
      owner.segment || "",
      ...owner.items.flatMap((item) => [item.alt, item.caption, item.role || ""]),
    ].join(" "));

    return searchable.includes(normalizedQuery);
  });
}
