import {
  ACCESS_COOKIE,
  SURFACE_COOKIE,
  allowedOrigin,
  parseCookies,
  secureJson,
  validCsrf,
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
const ALLOWED_KINDS = new Set([
  "flavor-cover",
  "whole-cake",
  "commercial-product",
  "commercial-segment",
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

function storageFolder(kind: string, ownerId: string) {
  if (kind === "commercial-product") return `commercial/products/${ownerId}`;
  if (kind === "commercial-segment") return `commercial/segments/${ownerId}`;
  return `produtos/${ownerId}`;
}

function expectedRatio(kind: string) {
  return kind === "flavor-cover" ? 1 : 4 / 3;
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
  if (request.method !== "POST")
    return secureJson({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request, env("SITE_URL")))
    return secureJson({ error: "Origem não autorizada." }, 403);
  if (!validCsrf(request))
    return secureJson({ error: "Validação CSRF inválida." }, 403);

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
    return secureJson({ error: "Biblioteca de imagens temporariamente indisponível." }, 503);

  const accessCheck = await callRpc(
    supabaseUrl,
    publishableKey,
    accessToken,
    "manager_assert_dynamic_image_access",
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

  const kind = textField(form, "asset_kind");
  const ownerId = textField(form, "owner_id");
  const label = textField(form, "label");
  const altText = textField(form, "alt_text");
  const sourceName = textField(form, "source_name") || "imagem";
  const original = fileField(form, "original");
  const edited = fileField(form, "edited");
  const width = Number(textField(form, "width"));
  const height = Number(textField(form, "height"));

  if (!ALLOWED_KINDS.has(kind))
    return secureJson({ error: "Tipo de imagem inválido." }, 400);
  if (kind === "commercial-segment" ? !SEGMENT_PATTERN.test(ownerId) : !UUID_PATTERN.test(ownerId))
    return secureJson({ error: "Identificador do item inválido." }, 400);
  if (label.length < 2 || label.length > 140 || altText.length > 300)
    return secureJson({ error: "Metadados da imagem inválidos." }, 400);
  if (!original || !edited)
    return secureJson({ error: "Envie a imagem original e a versão final." }, 400);
  if (!ALLOWED_ORIGINAL_TYPES.has(original.type) || original.size > MAX_ORIGINAL_BYTES)
    return secureJson({ error: "A imagem original deve ser JPG, PNG ou WebP e ter até 6 MB." }, 400);
  if (edited.type !== "image/webp" || edited.size <= 0 || edited.size > MAX_EDITED_BYTES)
    return secureJson({ error: "A imagem final deve ser WebP e ter até 900 KB." }, 400);
  if (!Number.isInteger(width) || !Number.isInteger(height)
      || Math.min(width, height) < MIN_EDGE
      || Math.max(width, height) > MAX_EDGE) {
    return secureJson({ error: "As dimensões finais da imagem são inválidas." }, 400);
  }

  const ratio = width / height;
  if (Math.abs(ratio - expectedRatio(kind)) > RATIO_TOLERANCE)
    return secureJson({ error: "A proporção final não corresponde ao formato deste item." }, 400);

  const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const folder = storageFolder(kind, ownerId);
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
    "manager_save_dynamic_image_asset",
    {
      requested_asset_kind: kind,
      requested_owner_id: ownerId,
      requested_image_url: imageUrl,
      requested_original_image_url: originalImageUrl,
      requested_alt_text: altText,
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
    const error = await upstreamError(saveResult, "Não foi possível registrar a imagem no catálogo.");
    return secureJson({ error }, saveResult.status >= 400 ? saveResult.status : 500);
  }

  const saved = await saveResult.json().catch(() => null);
  return secureJson({ data: saved }, 200);
};

export const config = { path: "/api/auth-bff-dynamic-image-upload" };
