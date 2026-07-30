import type { VisualAtlasCheckpoint } from "./generate-homologation-visual-atlas.mjs";

export type VisualAtlasImageManifestItem = {
  id: string;
  areaId: string;
  areaTitle: string;
  label: string;
  href: string;
  file: string;
  [key: string]: unknown;
};

export type VisualAtlasImagesManifest = {
  generatedAt: string;
  commit: string;
  productionChanged: false;
  totalAreas: number;
  totalImages: number;
  format: "svg";
  dimensions: {
    width: number;
    height: number;
  };
  images: VisualAtlasImageManifestItem[];
};

export const WIDTH: number;
export const HEIGHT: number;

export function slugify(value: unknown): string;
export function renderSvg(
  point: VisualAtlasCheckpoint,
  index: number,
  logoDataUri: string,
): string;
export function renderIndex(manifest: VisualAtlasImagesManifest): string;
export function generateImages(options: {
  outputDirectory: string;
  logoPath: string;
}): Promise<VisualAtlasImagesManifest>;
