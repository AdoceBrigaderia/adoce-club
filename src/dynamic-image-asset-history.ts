import type { DynamicImageAsset, DynamicImageKind } from "./image-library-dynamic";

export type DynamicImageAssetChangeType = "created" | "updated" | "deleted";

export type DynamicImageAssetVersion = {
  id: string;
  asset_key: string;
  asset_kind: DynamicImageKind;
  owner_id: string;
  label: string;
  image_url: string;
  original_image_url: string | null;
  change_type: DynamicImageAssetChangeType;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: string;
};

type FlavorCoverRestorePlan = {
  mode: "update";
  table: "flavors";
  matchColumn: "id";
  matchValue: string;
  values: { image_path: string };
};

type WholeCakeRestorePlan = {
  mode: "update";
  table: "flavors";
  matchColumn: "id";
  matchValue: string;
  values: {
    whole_cake_image_path: string;
    whole_cake_original_image_path: string | null;
    whole_cake_available: true;
  };
};

type CommercialProductRestorePlan = {
  mode: "update";
  table: "commercial_products";
  matchColumn: "id";
  matchValue: string;
  values: {
    image_url: string;
    original_image_url: string | null;
    updated_by: string;
  };
};

type CommercialSegmentRestorePlan = {
  mode: "upsert";
  table: "commercial_segment_media";
  onConflict: "segment";
  values: {
    segment: string;
    image_url: string;
    original_image_url: string | null;
    alt_text: string;
    updated_by: string;
  };
};

export type DynamicImageRestorePlan =
  | FlavorCoverRestorePlan
  | WholeCakeRestorePlan
  | CommercialProductRestorePlan
  | CommercialSegmentRestorePlan;

const CHANGE_LABELS: Record<DynamicImageAssetChangeType, string> = {
  created: "Imagem cadastrada",
  updated: "Imagem substituída",
  deleted: "Imagem removida",
};

export function dynamicImageAssetKey(asset: Pick<DynamicImageAsset, "kind" | "ownerId">) {
  if (asset.kind === "flavor-cover") return `flavor:${asset.ownerId}:cover`;
  if (asset.kind === "whole-cake") return `flavor:${asset.ownerId}:whole-cake`;
  if (asset.kind === "commercial-product") return `product:${asset.ownerId}:cover`;
  return `segment:${asset.ownerId}:cover`;
}

export function dynamicImageAssetChangeLabel(changeType: DynamicImageAssetChangeType) {
  return CHANGE_LABELS[changeType];
}

export function dynamicImageAssetVersionDate(value: string, locale = "pt-BR") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function dynamicImageAssetVersionIsCurrent(
  version: Pick<DynamicImageAssetVersion, "image_url">,
  currentUrl?: string | null,
) {
  return Boolean(currentUrl?.trim()) && version.image_url.trim() === currentUrl?.trim();
}

export function dynamicImageAssetRestorePlan(
  asset: DynamicImageAsset,
  version: DynamicImageAssetVersion,
  userId: string,
): DynamicImageRestorePlan {
  if (version.asset_kind !== asset.kind || version.owner_id !== asset.ownerId) {
    throw new Error("A versão selecionada não pertence a esta imagem.");
  }

  if (asset.kind === "flavor-cover") {
    return {
      mode: "update",
      table: "flavors",
      matchColumn: "id",
      matchValue: asset.ownerId,
      values: { image_path: version.image_url },
    };
  }

  if (asset.kind === "whole-cake") {
    return {
      mode: "update",
      table: "flavors",
      matchColumn: "id",
      matchValue: asset.ownerId,
      values: {
        whole_cake_image_path: version.image_url,
        whole_cake_original_image_path: version.original_image_url,
        whole_cake_available: true,
      },
    };
  }

  if (asset.kind === "commercial-product") {
    return {
      mode: "update",
      table: "commercial_products",
      matchColumn: "id",
      matchValue: asset.ownerId,
      values: {
        image_url: version.image_url,
        original_image_url: version.original_image_url,
        updated_by: userId,
      },
    };
  }

  return {
    mode: "upsert",
    table: "commercial_segment_media",
    onConflict: "segment",
    values: {
      segment: asset.ownerId,
      image_url: version.image_url,
      original_image_url: version.original_image_url,
      alt_text: asset.alt,
      updated_by: userId,
    },
  };
}
