import type { EditedProductImage } from "../admin-media";
import type { DynamicImageAssetVersion } from "../dynamic-image-asset-history";
import type {
  CommercialProductImageRow,
  CommercialSegmentImageRow,
  DynamicImageKind,
  FlavorImageRow,
} from "../image-library-dynamic";
import { getBffSession, readBffCsrfToken } from "./bff-auth";
import { bffRpc } from "./bff-rpc";

export type DynamicImageWorkspace = {
  flavors: FlavorImageRow[];
  products: CommercialProductImageRow[];
  segments: CommercialSegmentImageRow[];
  generated_at: string;
};

type UploadMetadata = {
  kind: DynamicImageKind;
  ownerId: string;
  label: string;
  altText: string;
  sourceName: string;
};

type UploadEnvelope = {
  data?: Record<string, unknown>;
  error?: string;
  code?: string;
};

async function uploadRequest(metadata: UploadMetadata, edited: EditedProductImage) {
  const csrfToken = readBffCsrfToken();
  if (!csrfToken) throw new Error("A sessão não possui validação CSRF.");

  const form = new FormData();
  form.set("asset_kind", metadata.kind);
  form.set("owner_id", metadata.ownerId);
  form.set("label", metadata.label);
  form.set("alt_text", metadata.altText);
  form.set("source_name", metadata.sourceName);
  form.set("width", String(edited.width));
  form.set("height", String(edited.height));
  form.set("original", edited.sourceFile, edited.sourceFile.name);
  form.set("edited", edited.blob, `${metadata.sourceName || "imagem"}.webp`);

  return fetch("/api/auth-bff-dynamic-image-upload", {
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
  return payload.data || {};
}

export function getDynamicImageWorkspace() {
  return bffRpc<DynamicImageWorkspace>("manager_get_dynamic_image_workspace");
}

export function listDynamicImageVersions(assetKey: string, limit = 20) {
  return bffRpc<DynamicImageAssetVersion[]>("manager_list_dynamic_image_versions", {
    requested_asset_key: assetKey,
    requested_limit: limit,
  });
}

export function restoreDynamicImageVersion(versionId: string) {
  return bffRpc<Record<string, unknown>>("manager_restore_dynamic_image_version", {
    requested_version_id: versionId,
  });
}

export async function uploadDynamicImageAsset(
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
