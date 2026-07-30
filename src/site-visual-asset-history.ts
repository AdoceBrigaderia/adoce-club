export type SiteVisualAssetChangeType = "created" | "updated" | "deleted";

export type SiteVisualAssetVersion = {
  id: string;
  asset_key: string;
  label: string;
  section: string;
  default_url: string;
  image_url: string;
  original_image_url: string | null;
  alt_text: string;
  active: boolean;
  change_type: SiteVisualAssetChangeType;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: string;
};

export type SiteVisualAssetRestorePayload = {
  asset_key: string;
  label: string;
  section: string;
  default_url: string;
  image_url: string;
  original_image_url: string | null;
  alt_text: string;
  active: true;
  updated_by: string;
};

const CHANGE_LABELS: Record<SiteVisualAssetChangeType, string> = {
  created: "Imagem cadastrada",
  updated: "Imagem substituída",
  deleted: "Personalização removida",
};

export function siteVisualAssetChangeLabel(changeType: SiteVisualAssetChangeType) {
  return CHANGE_LABELS[changeType];
}

export function siteVisualAssetVersionDate(value: string, locale = "pt-BR") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function siteVisualAssetVersionIsCurrent(
  version: Pick<SiteVisualAssetVersion, "image_url">,
  currentUrl?: string | null,
) {
  return Boolean(currentUrl?.trim()) && version.image_url.trim() === currentUrl?.trim();
}

export function siteVisualAssetRestorePayload(
  version: SiteVisualAssetVersion,
  userId: string,
): SiteVisualAssetRestorePayload {
  return {
    asset_key: version.asset_key,
    label: version.label,
    section: version.section,
    default_url: version.default_url,
    image_url: version.image_url,
    original_image_url: version.original_image_url,
    alt_text: version.alt_text,
    active: true,
    updated_by: userId,
  };
}
