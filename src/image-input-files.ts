export type ImageFileCandidate = {
  type: string;
};

export function firstSupportedImageFile<T extends ImageFileCandidate>(
  files: ArrayLike<T>,
  supportedTypes: readonly string[],
) {
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (file && supportedTypes.includes(file.type)) return file;
  }
  return null;
}
