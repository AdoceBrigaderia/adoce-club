import type { SupabaseClient } from "@supabase/supabase-js";

export const PRODUCT_IMAGE_LIMIT = 6;
export const PRODUCT_IMAGE_MAX_BYTES = 6 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_EDGE = 1600;
export const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const EDITED_IMAGE_MAX_BYTES = 750 * 1024;
export const EDITED_IMAGE_MIN_EDGE = 320;
export const EDITED_IMAGE_MAX_EDGE = 2400;
export const EDITED_IMAGE_ALLOWED_RATIOS = [1, 4 / 3, 4 / 5, 16 / 9, 16 / 10, 9 / 16] as const;
export const EDITED_IMAGE_RATIO_TOLERANCE = 0.02;

export type EditedProductImage = {
  blob: Blob;
  sourceFile: File;
  width: number;
  height: number;
};

export type UploadedProductImage = {
  imageUrl: string;
  originalImageUrl: string;
};

export function validateProductImage(file: Pick<File, "size" | "type">) {
  if (!PRODUCT_IMAGE_TYPES.includes(file.type)) {
    return "Use uma imagem JPG, PNG ou WebP.";
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return "A imagem original deve ter no máximo 6 MB.";
  }
  return "";
}

export function validateEditedProductImage(
  image: Pick<EditedProductImage, "blob" | "width" | "height">,
) {
  if (image.blob.type !== "image/webp") {
    return "A imagem final deve estar no formato WebP.";
  }
  if (image.blob.size <= 0) {
    return "A imagem final está vazia.";
  }
  if (image.blob.size > EDITED_IMAGE_MAX_BYTES) {
    return "A imagem final deve ter no máximo 750 KB.";
  }
  if (
    !Number.isInteger(image.width)
    || !Number.isInteger(image.height)
    || image.width <= 0
    || image.height <= 0
  ) {
    return "As dimensões finais da imagem são inválidas.";
  }
  if (Math.min(image.width, image.height) < EDITED_IMAGE_MIN_EDGE) {
    return "A menor dimensão da imagem final deve ter pelo menos 320 px.";
  }
  if (Math.max(image.width, image.height) > EDITED_IMAGE_MAX_EDGE) {
    return "A maior dimensão da imagem final deve ter no máximo 2400 px.";
  }

  const ratio = image.width / image.height;
  const approvedRatio = EDITED_IMAGE_ALLOWED_RATIOS.some(
    (allowed) => Math.abs(ratio - allowed) <= EDITED_IMAGE_RATIO_TOLERANCE,
  );
  if (!approvedRatio) {
    return "A proporção final não corresponde a um formato aprovado pela Adoce.";
  }
  return "";
}

function originalExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function uploadEditedProductImage(
  supabase: SupabaseClient,
  folder: string,
  name: string,
  edited: EditedProductImage,
): Promise<UploadedProductImage> {
  const sourceValidation = validateProductImage(edited.sourceFile);
  if (sourceValidation) throw new Error(sourceValidation);

  const outputValidation = validateEditedProductImage(edited);
  if (outputValidation) throw new Error(outputValidation);

  const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const safeName = safeMediaFileName(name);
  const originalPath = `${folder}/${unique}-${safeName}-original.${originalExtension(edited.sourceFile)}`;
  const imagePath = `${folder}/${unique}-${safeName}.webp`;
  const bucket = supabase.storage.from("adoce-media");

  const { error: originalError } = await bucket.upload(
    originalPath,
    edited.sourceFile,
    { contentType: edited.sourceFile.type, upsert: false },
  );
  if (originalError) throw originalError;

  const { error: imageError } = await bucket.upload(imagePath, edited.blob, {
    contentType: "image/webp",
    upsert: false,
  });
  if (imageError) throw imageError;

  return {
    originalImageUrl: bucket.getPublicUrl(originalPath).data.publicUrl,
    imageUrl: bucket.getPublicUrl(imagePath).data.publicUrl,
  };
}

export async function normalizeProductImage(file: File): Promise<Blob> {
  const validation = validateProductImage(file);
  if (validation) throw new Error(validation);

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    PRODUCT_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar esta imagem.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Não foi possível otimizar a imagem.")),
      "image/webp",
      0.86,
    ),
  );
}

export function safeMediaFileName(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "imagem"
  );
}
