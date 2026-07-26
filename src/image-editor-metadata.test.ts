import { describe, expect, it } from "vitest";
import { formatImageBytes, imageAspectRatioLabel, imageDimensionsLabel } from "./image-editor-metadata";

describe("metadados técnicos do editor de imagens", () => {
  it("formata bytes, KB e MB de forma legível", () => {
    expect(formatImageBytes(800)).toBe("800 B");
    expect(formatImageBytes(1536)).toBe("1.5 KB");
    expect(formatImageBytes(2 * 1024 * 1024)).toBe("2 MB");
  });

  it("identifica proporções comuns sem aproximação confusa", () => {
    expect(imageAspectRatioLabel(1200, 900)).toBe("4:3");
    expect(imageAspectRatioLabel(1080, 1920)).toBe("9:16");
    expect(imageAspectRatioLabel(1600, 1000)).toBe("8:5");
  });

  it("trata dimensões ausentes de forma segura", () => {
    expect(imageAspectRatioLabel(0, 0)).toBe("—");
    expect(imageDimensionsLabel(0, 0)).toBe("Carregando…");
  });

  it("exibe dimensões finais em pixels", () => {
    expect(imageDimensionsLabel(1400, 1050)).toBe("1400 × 1050 px");
  });
});
