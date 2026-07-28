import type { EditedProductImage } from "../admin-media";
import type { SiteVisualAssetVersion } from "../site-visual-asset-history";
import { getBffSession, readBffCsrfToken } from "./bff-auth";
import { bffRpc } from "./bff-rpc";

export type StoredSiteVisualAsset = {
  asset_key: string;
  label: string;
  section: string;
  default_url: string;
  image_url: string;
  original_image_url: string | null;
  alt_text: string;
  active: boolean;
  updated_at: string;
};

export type SiteVisualWorkspace = {
  assets: StoredSiteVisualAsset[];
  generated_at: string;
};

type UploadMetadata = {
  assetKey: string;
  label: string;
  section: string;
  defaultUrl: string;
  altText: string;
  sourceName: string;
};

type UploadEnvelope = {
  data?: StoredSiteVisualAsset;
  error?: string;
  code?: string;
};

async function uploadRequest(metadata: UploadMetadata, edited: EditedProductImage) {
  const csrfToken = readBffCsrfToken();
  if (!csrfToken) throw new Error("A sessão não possui validação CSRF.");

  const form = new FormData();
  form.set("asset_key", metadata.assetKey);
  form.set("label", metadata.label);
  form.set("section", metadata.section);
  form.set("default_url", metadata.defaultUrl);
  form.set("alt_text", metadata.altText);
  form.set("source_name", metadata.sourceName);
  form.set("width", String(edited.width));
  form.set("height", String(edited.height));
  form.set("original", edited.sourceFile, edited.sourceFile.name);
  form.set("edited", edited.blob, `${metadata.sourceName || "imagem"}.webp`);

  return fetch("/api/auth-bff-site-visual-upload", {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-CSRF-Token": csrfToken },
    body: form,
  });
}

async function parseUpload(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as UploadEnvelope;
  if (!response.ok) {
    const error = new Error(payload.error || "Não foi possível publicar a imagem.") as Error & {
      code?: string;
      status?: number;
    };
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload.data as StoredSiteVisualAsset;
}

export async function getSiteVisualWorkspace() {
  return bffRpc<SiteVisualWorkspace>("manager_get_site_visual_assets_workspace");
}

export async function listSiteVisualVersions(assetKey: string, limit = 20) {
  return bffRpc<SiteVisualAssetVersion[]>("manager_list_site_visual_asset_versions", {
    requested_asset_key: assetKey,
    requested_limit: limit,
  });
}

export async function resetSiteVisualAsset(assetKey: string) {
  return bffRpc<{ asset_key: string; reset: boolean; default_url?: string }>(
    "manager_reset_site_visual_asset",
    { requested_asset_key: assetKey },
  );
}

export async function restoreSiteVisualAssetVersion(versionId: string) {
  return bffRpc<StoredSiteVisualAsset>("manager_restore_site_visual_asset_version", {
    requested_version_id: versionId,
  });
}

export async function uploadSiteVisualAsset(
  metadata: UploadMetadata,
  edited: EditedProductImage,
) {
  const first = await uploadRequest(metadata, edited);
  if (first.ok) return parseUpload(first);

  const firstPayload = (await first.json().catch(() => ({}))) as UploadEnvelope;
  if (first.status !== 401 || firstPayload.code !== "session_refresh_required") {
    const error = new Error(firstPayload.error || "Não foi possível publicar a imagem.") as Error & {
      code?: string;
      status?: number;
    };
    error.code = firstPayload.code;
    error.status = first.status;
    throw error;
  }

  const session = await getBffSession();
  if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
  return parseUpload(await uploadRequest(metadata, edited));
}
