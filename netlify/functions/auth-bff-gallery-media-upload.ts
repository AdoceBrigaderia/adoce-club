import { guardBffRequest } from "./_shared/request-security";
import {
  ACCESS_COOKIE,
  SURFACE_COOKIE,
  parseCookies,
  secureJson,
} from "./_shared/session-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const MAX_ORIGINAL_BYTES = 6 * 1024 * 1024;
const MAX_EDITED_BYTES = 900 * 1024;
const MIN_EDGE = 320;
const MAX_EDGE = 2400;
const RATIO_TOLERANCE = 0.02;
const ALLOWED_ORIGINAL_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_OWNER_KINDS = new Set([
  "flavor-gallery",
  "commercial-product-gallery",
  "commercial-segment-gallery",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEGMENT_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

function textField(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function fileField(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value !== "string" && value instanceof Blob ? value : null;
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "imagem"
  );
}

function encodedStoragePath(path: string) {
  return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function originalExtension(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function storageFolder(ownerKind: string, ownerId: string) {
  if (ownerKind === "flavor-gallery") return `produtos/${ownerId}`;
  return `commercial/galleries/${ownerId}`;
}

function expectedRatio(ownerKind: string) {
  return ownerKind === "flavor-gallery" ? 1 : 4 / 3;
}

async function callRpc(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
  rpc: string,
  params: Record<string, unknown> = {},
) {
  return fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
}

async function uploadObject(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
  path: string,
  blob: Blob,
) {
  return fetch(
    `${supabaseUrl}/storage/v1/object/adoce-media/${encodedStoragePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": blob.type,
        "cache-control": "3600",
        "x-upsert": "false",
      },
      body: blob,
    },
  );
}

async function deleteObject(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
  path: string,
) {
  await fetch(
    `${supabaseUrl}/storage/v1/object/adoce-media/${encodedStoragePath(path)}`,
    {
      method: "DELETE",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  ).catch(() => undefined);
}

function publicObjectUrl(supabaseUrl: string, path: string) {
  return `${supabaseUrl}/storage/v1/object/public/adoce-media/${encodedStoragePath(path)}`;
}

async function upstreamError(response: Response, fallback: string) {
  const raw = await response.text().catch(() => "");
  if (!raw) return fallback;
  try {
    const payload = JSON.parse(raw) as { message?: string; error?: string };
    return payload.message || payload.error || fallback;
  } catch {
    return fallback;
  }
}

export default async (request: Request) => {
  const requestRejection = guardBffRequest(request, {
    methods: ["POST"],
    configuredSiteUrl: env("SITE_URL"),
    requireCsrf: true,
  });
  if (requestRejection) return requestRejection;

  const cookies = parseCookies(request);
  if (cookies.get(SURFACE_COOKIE) !== "operation")
    return secureJson({ error: "Sessão operacional obrigatória." }, 403);

  const accessToken = cookies.get(ACCESS_COOKIE) || "";
  if (!accessToken)
    return secureJson(
      { error: "Sessão expirada.", code: "session_refresh_required" },
      401,
    );

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey)
    return secureJson({ error: "Galerias temporariamente indisponíveis." }, 503);

  const accessCheck = await callRpc(
    supabaseUrl,
    publishableKey,
    accessToken,
    "manager_assert_gallery_media_access",
  );
  if (accessCheck.status === 401)
    return secureJson(
      { error: "Sessão expirada.", code: "session_refresh_required" },
      401,
    );
  if (!accessCheck.ok)
    return secureJson({ error: "Acesso restrito a proprietário e gerente." }, 403);

  const form = await request.formData().catch(() => null);
  if (!form) return secureJson({ error: "Arquivo de imagem inválido." }, 400);

  const ownerKind = textField(form, "owner_kind");
  const ownerId = textField(form, "owner_id");
  const mediaId = textField(form, "media_id");
  const label = textField(form, "label");
  const altText = textField(form, "alt_text");
  const caption = textField(form, "caption");
  const role = textField(form, "role") || "gallery";
  const sortOrderText = textField(form, "sort_order");
  const sourceName = textField(form, "source_name") || "imagem";
  const original = fileField(form, "original");
  const edited = fileField(form, "edited");
  const width = Number(textField(form, "width"));
  const height = Number(textField(form, "height"));
  const sortOrder = sortOrderText === "" ? null : Number(sortOrderText);

  if (!ALLOWED_OWNER_KINDS.has(ownerKind))
    return secureJson({ error: "Tipo de galeria inválido." }, 400);
  if (ownerKind === "commercial-segment-gallery"
    ? !SEGMENT_PATTERN.test(ownerId)
    : !UUID_PATTERN.test(ownerId))
    return secureJson({ error: "Identificador da galeria inválido." }, 400);
  if (mediaId && !UUID_PATTERN.test(mediaId))
    return secureJson({ error: "Identificador da mídia inválido." }, 400);
  if (label.length < 2 || label.length > 140 || altText.length > 300 || caption.length > 500)
    return secureJson({ error: "Metadados da imagem inválidos." }, 400);
  if (role.length > 50)
    return secureJson({ error: "Função da imagem inválida." }, 400);
  if (sortOrder !== null && (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000))
    return secureJson({ error: "Ordem da mídia inválida." }, 400);
  if (!original || !edited)
    return secureJson({ error: "Envie a imagem original e a versão final." }, 400);
  if (!ALLOWED_ORIGINAL_TYPES.has(original.type) || original.size > MAX_ORIGINAL_BYTES)
    return secureJson({ error: "A imagem original deve ser JPG, PNG ou WebP e ter até 6 MB." }, 400);
  if (edited.type !== "image/webp" || edited.size <= 0 || edited.size > MAX_EDITED_BYTES)
    return secureJson({ error: "A imagem final deve ser WebP e ter até 900 KB." }, 400);
  if (!Number.isInteger(width) || !Number.isInteger(height)
      || Math.min(width, height) < MIN_EDGE
      || Math.max(width, height) > MAX_EDGE)
    return secureJson({ error: "As dimensões finais da imagem são inválidas." }, 400);

  const ratio = width / height;
  if (Math.abs(ratio - expectedRatio(ownerKind)) > RATIO_TOLERANCE)
    return secureJson({ error: "A proporção final não corresponde ao formato desta galeria." }, 400);

  const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const folder = storageFolder(ownerKind, ownerId);
  const safeName = safeFileName(sourceName);
  const originalPath = `${folder}/${unique}-${safeName}-original.${originalExtension(original.type)}`;
  const editedPath = `${folder}/${unique}-${safeName}.webp`;

  const originalUpload = await uploadObject(
    supabaseUrl,
    publishableKey,
    accessToken,
    originalPath,
    original,
  );
  if (!originalUpload.ok) {
    const error = await upstreamError(originalUpload, "Não foi possível guardar a imagem original.");
    return secureJson({ error }, originalUpload.status >= 400 ? originalUpload.status : 500);
  }

  const editedUpload = await uploadObject(
    supabaseUrl,
    publishableKey,
    accessToken,
    editedPath,
    edited,
  );
  if (!editedUpload.ok) {
    await deleteObject(supabaseUrl, publishableKey, accessToken, originalPath);
    const error = await upstreamError(editedUpload, "Não foi possível guardar a imagem final.");
    return secureJson({ error }, editedUpload.status >= 400 ? editedUpload.status : 500);
  }

  const imageUrl = publicObjectUrl(supabaseUrl, editedPath);
  const originalImageUrl = publicObjectUrl(supabaseUrl, originalPath);
  const saveResult = await callRpc(
    supabaseUrl,
    publishableKey,
    accessToken,
    "manager_save_gallery_media_asset",
    {
      requested_owner_kind: ownerKind,
      requested_owner_id: ownerId,
      requested_image_url: imageUrl,
      requested_original_image_url: originalImageUrl,
      requested_media_id: mediaId || null,
      requested_alt_text: altText,
      requested_caption: caption,
      requested_role: role,
      requested_sort_order: sortOrder,
    },
  );

  if (!saveResult.ok) {
    await Promise.all([
      deleteObject(supabaseUrl, publishableKey, accessToken, originalPath),
      deleteObject(supabaseUrl, publishableKey, accessToken, editedPath),
    ]);
    if (saveResult.status === 401)
      return secureJson(
        { error: "Sessão expirada.", code: "session_refresh_required" },
        401,
      );
    const error = await upstreamError(saveResult, "Não foi possível registrar a mídia na galeria.");
    return secureJson({ error }, saveResult.status >= 400 ? saveResult.status : 500);
  }

  const saved = await saveResult.json().catch(() => null);
  return secureJson({ data: saved }, 200);
};

export const config = { path: "/api/auth-bff-gallery-media-upload" };
