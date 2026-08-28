import { describe, expect, it } from "vitest";
import { analyzeImageFit, imageOutputHeight } from "./image-fit-analysis";

describe("análise de encaixe das imagens", () => {
  it("calcula a altura exata da saída", () => {
    expect(imageOutputHeight(1400, 4, 3)).toBe(1050);
    expect(imageOutputHeight(1400, 1, 1)).toBe(1400);
  });

  it("avisa quando uma imagem será distorcida para preencher", () => {
    const result = analyzeImageFit({
      sourceWidth: 1600,
      sourceHeight: 900,
      targetWidth: 1400,
      targetHeight: 1400,
      mode: "stretch",
    });
    expect(result.distorted).toBe(true);
    expect(result.cropped).toBe(false);
    expect(result.title).toContain("distorção");
  });

  it("explica que fundo transparente aparece no modo foto inteira", () => {
    const result = analyzeImageFit({
      sourceWidth: 1600,
      sourceHeight: 900,
      targetWidth: 900,
      targetHeight: 900,
      mode: "contain",
    });
    expect(result.hasMargins).toBe(true);
    expect(result.detail).toContain("transparentes");
  });
});
