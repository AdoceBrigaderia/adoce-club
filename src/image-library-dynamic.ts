import { IMAGE_PLACEHOLDERS } from "./image-placeholders";

export type DynamicImageKind =
  | "flavor-cover"
  | "whole-cake"
  | "commercial-product"
  | "commercial-segment";

export type FlavorImageRow = {
  id: string;
  name: string;
  image_path: string | null;
  whole_cake_image_path: string | null;
  whole_cake_original_image_path: string | null;
  whole_cake_available: boolean;
  active: boolean;
};

export type CommercialProductImageRow = {
  id: string;
  name: string;
  segment: string;
  image_url: string | null;
  original_image_url: string | null;
  active: boolean;
};

export type CommercialSegmentImageRow = {
  segment: string;
  image_url: string;
  original_image_url: string | null;
};

export type DynamicImageAsset = {
  id: string;
  kind: DynamicImageKind;
  ownerId: string;
  label: string;
  section: string;
  description: string;
  alt: string;
  currentUrl: string;
  originalUrl: string | null;
  aspectWidth: number;
  aspectHeight: number;
  outputWidth: number;
  acceptedFormats: string;
  usage: string;
  storageFolder: string;
  segment?: string;
};

const segmentLabels: Record<string, string> = {
  cakes: "Tortas inteiras",
  sweets: "Doces e sobremesas",
  events: "Eventos e encomendas",
  gifts: "Presentes",
  services: "Serviços",
};

export function dynamicImageOutputHeight(
  asset: Pick<DynamicImageAsset, "outputWidth" | "aspectWidth" | "aspectHeight">,
) {
  return Math.round(asset.outputWidth * asset.aspectHeight / asset.aspectWidth);
}

export function buildDynamicImageAssets({
  flavors,
  products,
  segments,
}: {
  flavors: FlavorImageRow[];
  products: CommercialProductImageRow[];
  segments: CommercialSegmentImageRow[];
}) {
  const assets: DynamicImageAsset[] = [];

  flavors.filter((item) => item.active).forEach((flavor) => {
    assets.push({
      id: `flavor-cover:${flavor.id}`,
      kind: "flavor-cover",
      ownerId: flavor.id,
      label: flavor.name,
      section: "Fatias e sabores",
      description: "Foto principal exibida no Adoce Hoje, pedidos, Pede Junto e cartão do sabor.",
      alt: `${flavor.name} — foto oficial da fatia`,
      currentUrl: flavor.image_path?.trim() || IMAGE_PLACEHOLDERS.flavor,
      originalUrl: null,
      aspectWidth: 1,
      aspectHeight: 1,
      outputWidth: 1200,
      acceptedFormats: "JPG, PNG ou WebP",
      usage: "Capa do sabor em todas as jornadas públicas e operacionais",
      storageFolder: `produtos/${flavor.id}`,
    });

    if (flavor.whole_cake_available) {
      assets.push({
        id: `whole-cake:${flavor.id}`,
        kind: "whole-cake",
        ownerId: flavor.id,
        label: `${flavor.name} — torta inteira`,
        section: "Tortas inteiras",
        description: "Foto oficial da torta inteira vinculada a este sabor.",
        alt: `${flavor.name} — foto oficial da torta inteira`,
        currentUrl: flavor.whole_cake_image_path?.trim() || IMAGE_PLACEHOLDERS.wholeCake,
        originalUrl: flavor.whole_cake_original_image_path,
        aspectWidth: 4,
        aspectHeight: 3,
        outputWidth: 1400,
        acceptedFormats: "JPG, PNG ou WebP",
        usage: "Catálogo de tortas, encomendas e detalhes do produto",
        storageFolder: `produtos/${flavor.id}`,
      });
    }
  });

  products.filter((item) => item.active).forEach((product) => {
    const wholeCake = product.segment === "cakes";
    assets.push({
      id: `commercial-product:${product.id}`,
      kind: "commercial-product",
      ownerId: product.id,
      label: product.name,
      section: wholeCake ? "Tortas e produtos comerciais" : "Produtos e serviços",
      description: "Capa principal do produto no catálogo comercial.",
      alt: `${product.name} — imagem oficial`,
      currentUrl: product.image_url?.trim()
        || (wholeCake ? IMAGE_PLACEHOLDERS.wholeCake : IMAGE_PLACEHOLDERS.product),
      originalUrl: product.original_image_url,
      aspectWidth: 4,
      aspectHeight: 3,
      outputWidth: 1400,
      acceptedFormats: "JPG, PNG ou WebP",
      usage: "Catálogo comercial, detalhes e compartilhamentos",
      storageFolder: `commercial/products/${product.id}`,
      segment: product.segment,
    });
  });

  segments.forEach((segment) => {
    const label = segmentLabels[segment.segment] || segment.segment;
    assets.push({
      id: `commercial-segment:${segment.segment}`,
      kind: "commercial-segment",
      ownerId: segment.segment,
      label: `Categoria — ${label}`,
      section: "Categorias comerciais",
      description: "Imagem de apresentação da categoria no catálogo.",
      alt: `Categoria ${label} da Adoce`,
      currentUrl: segment.image_url?.trim() || IMAGE_PLACEHOLDERS.product,
      originalUrl: segment.original_image_url,
      aspectWidth: 4,
      aspectHeight: 3,
      outputWidth: 1600,
      acceptedFormats: "JPG, PNG ou WebP",
      usage: "Abertura da categoria e navegação do catálogo",
      storageFolder: `commercial/segments/${segment.segment}`,
      segment: segment.segment,
    });
  });

  return assets.sort(
    (a, b) => a.section.localeCompare(b.section, "pt-BR")
      || a.label.localeCompare(b.label, "pt-BR"),
  );
}
