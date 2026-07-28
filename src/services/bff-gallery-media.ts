import type { EditedProductImage } from "../admin-media";
import type { GalleryMediaVersion } from "../gallery-media-history";
import type {
  CommercialGalleryMediaRow,
  CommercialGalleryProductRow,
  FlavorGalleryImageRow,
  FlavorGalleryOwnerRow,
  GalleryOwnerKind,
} from "../image-library-galleries";
import { getBffSession, readBffCsrfToken } from "./bff-auth";
import { bffRpc } from "./bff-rpc";

export type GalleryMediaWorkspace = {
  flavors: FlavorGalleryOwnerRow[];
  flavor_images: FlavorGalleryImageRow[];
  products: CommercialGalleryProductRow[];
  commercial_media: CommercialGalleryMediaRow[];
  generated_at: string;
};

type GalleryUploadMetadata = {
  ownerKind: GalleryOwnerKind;
  ownerId: string;
  mediaId?: string;
  label: string;
  altText: string;
  caption: string;
  role?: string;
  sortOrder?: number;
  sourceName: string;
};

type UploadEnvelope = {
  data?: Record<string, unknown>;
  error?: string;
  code?: string;
};

async function uploadRequest(
  metadata: GalleryUploadMetadata,
  edited: EditedProductImage,
) {
  const csrfToken = readBffCsrfToken();
  if (!csrfToken) throw new Error("A sessão não possui validação CSRF.");

  const form = new FormData();
  form.set("owner_kind", metadata.ownerKind);
  form.set("owner_id", metadata.ownerId);
  if (metadata.mediaId) form.set("media_id", metadata.mediaId);
  form.set("label", metadata.label);
  form.set("alt_text", metadata.altText);
  form.set("caption", metadata.caption);
  form.set("role", metadata.role || "gallery");
  if (metadata.sortOrder !== undefined)
    form.set("sort_order", String(metadata.sortOrder));
  form.set("source_name", metadata.sourceName);
  form.set("width", String(edited.width));
  form.set("height", String(edited.height));
  form.set("original", edited.sourceFile, edited.sourceFile.name);
  form.set("edited", edited.blob, `${metadata.sourceName || "imagem"}.webp`);

  return fetch("/api/auth-bff-gallery-media-upload", {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-CSRF-Token": csrfToken },
    body: form,
  });
}

async function parseUpload(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as UploadEnvelope;
  if (!response.ok) {
    const error = new Error(
      payload.error || "Não foi possível publicar a mídia na galeria.",
    ) as Error & { code?: string; status?: number };
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload.data || {};
}

export function getGalleryMediaWorkspace() {
  return bffRpc<GalleryMediaWorkspace>("manager_get_gallery_media_workspace");
}

export function disableGalleryMedia(
  ownerKind: GalleryOwnerKind,
  ownerId: string,
  mediaId: string,
) {
  return bffRpc<Record<string, unknown>>("manager_disable_gallery_media", {
    requested_owner_kind: ownerKind,
    requested_owner_id: ownerId,
    requested_media_id: mediaId,
  });
}

export function listGalleryMediaVersions(mediaKey: string, limit = 20) {
  return bffRpc<GalleryMediaVersion[]>("manager_list_gallery_media_versions", {
    requested_media_key: mediaKey,
    requested_limit: limit,
  });
}

export function restoreGalleryMediaVersion(versionId: string) {
  return bffRpc<Record<string, unknown>>("manager_restore_gallery_media_version", {
    requested_version_id: versionId,
  });
}

export async function uploadGalleryMedia(
  metadata: GalleryUploadMetadata,
  edited: EditedProductImage,
) {
  const first = await uploadRequest(metadata, edited);
  if (first.ok) return parseUpload(first);

  const firstPayload = (await first.json().catch(() => ({}))) as UploadEnvelope;
  if (first.status !== 401 || firstPayload.code !== "session_refresh_required") {
    const error = new Error(
      firstPayload.error || "Não foi possível publicar a mídia na galeria.",
    ) as Error & { code?: string; status?: number };
    error.code = firstPayload.code;
    error.status = first.status;
    throw error;
  }

  const session = await getBffSession();
  if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
  return parseUpload(await uploadRequest(metadata, edited));
}
