export function formatImageBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${trimDecimal(bytes / 1024)} KB`;
  return `${trimDecimal(bytes / (1024 * 1024))} MB`;
}

function trimDecimal(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(Math.round(a));
  let right = Math.abs(Math.round(b));
  while (right) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left || 1;
}

export function imageAspectRatioLabel(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return "—";
  const divisor = greatestCommonDivisor(width, height);
  const ratioWidth = Math.round(width) / divisor;
  const ratioHeight = Math.round(height) / divisor;
  if (ratioWidth <= 32 && ratioHeight <= 32) return `${ratioWidth}:${ratioHeight}`;
  return `${trimDecimal(width / height)}:1`;
}

export function imageDimensionsLabel(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return "Carregando…";
  return `${Math.round(width)} × ${Math.round(height)} px`;
}
