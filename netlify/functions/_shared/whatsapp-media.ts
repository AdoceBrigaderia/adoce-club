import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

export type WhatsAppMediaKind = "audio" | "image" | "video" | "document";

export const mediaKindFromContentType = (contentType: string): WhatsAppMediaKind => {
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "document";
};

const safeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "media";

export async function downloadAndStoreTwilioMedia(
  admin: SupabaseClient,
  mediaUrl: string,
  contentType: string,
  accountSid: string,
  authToken: string,
  pathPrefix: string,
  filenameHint = "media",
) {
  if (!/^https:\/\//i.test(mediaUrl)) throw new Error("media_url_invalid");
  const response = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}` },
  });
  if (!response.ok) throw new Error(`media_download_${response.status}`);
  const declared = Number(response.headers.get("content-length") || "0");
  if (declared > MAX_MEDIA_BYTES) throw new Error("media_too_large");
  const blob = await response.blob();
  if (!blob.size || blob.size > MAX_MEDIA_BYTES) throw new Error("media_too_large");
  const normalizedType = contentType || blob.type || "application/octet-stream";
  const kind = mediaKindFromContentType(normalizedType);
  const storagePath = `${pathPrefix}/${crypto.randomUUID()}-${safeName(filenameHint)}`;
  const upload = await admin.storage.from("whatsapp-support-media").upload(storagePath, blob, {
    contentType: normalizedType,
    upsert: false,
  });
  if (upload.error) throw new Error(`media_upload:${upload.error.message}`);
  return {
    kind,
    storagePath,
    contentType: normalizedType,
    filename: safeName(filenameHint),
    sizeBytes: blob.size,
  };
}
