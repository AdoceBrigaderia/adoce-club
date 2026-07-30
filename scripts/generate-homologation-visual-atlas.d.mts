export type VisualAtlasArea = {
  id: string;
  title: string;
  href: string;
  items: string[];
};

export type VisualAtlasCheckpoint = {
  id: string;
  areaId: string;
  areaTitle: string;
  href: string;
  label: string;
};

export const AREAS: VisualAtlasArea[];
export const EXPECTED_TOTAL: number;

export function checkpoints(): VisualAtlasCheckpoint[];
export function renderHtml(): string;
export function validateAtlas(): VisualAtlasCheckpoint[];
