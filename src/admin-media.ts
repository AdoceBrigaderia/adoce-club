export const PRODUCT_IMAGE_LIMIT = 6;
export const PRODUCT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_EDGE = 1600;
export const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateProductImage(file: Pick<File, "size" | "type">) {
  if (!PRODUCT_IMAGE_TYPES.includes(file.type)) {
    return "Use uma imagem JPG, PNG ou WebP.";
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return "A imagem original deve ter no máximo 4 MB.";
  }
  return "";
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
