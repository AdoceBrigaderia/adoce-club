import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_IMAGE_PRESET,
  PRODUCT_IMAGE_PRESET,
} from "./ImageEditor";

describe("editor de imagens dos produtos", () => {
  it("padroniza produtos e categorias em 4:3 sem mudar o comportamento atual", () => {
    expect(PRODUCT_IMAGE_PRESET).toMatchObject({ aspectWidth: 4, aspectHeight: 3, outputWidth: 1200 });
    expect(CATEGORY_IMAGE_PRESET).toMatchObject({ aspectWidth: 4, aspectHeight: 3, outputWidth: 1400 });
  });

  it("oferece enquadramento, toque, comparação e ajustes da foto real", () => {
    const source = readFileSync(new URL("./ImageEditor.tsx", import.meta.url), "utf8");
    expect(source).toContain("type ImageFitMode");
    expect(source).toContain('resetPosition("stretch")');
    expect(source).toContain("onPointerMove");
    expect(source).toContain("pointers.current.size >= 2");
    expect(source).toContain("Melhorar automaticamente");
    expect(source).toContain("Segure para comparar com a original");
  });

  it("é usado nos produtos comerciais, capas e galeria de sabores", () => {
    const commercial = readFileSync(new URL("./OperationCommercialAdmin.tsx", import.meta.url), "utf8");
    const content = readFileSync(new URL("./OperationContentAdmin.tsx", import.meta.url), "utf8");
    expect(commercial).toContain("applyCommercialImage");
    expect(commercial).toContain("CATEGORY_IMAGE_PRESET");
    expect(content).toContain("applyFlavorImage");
    expect(content).toContain("original_image_path");
  });

  it("mostra a moldura final e confirma se a foto preenche todo o espaço", () => {
    const editor = readFileSync(new URL("./ImageEditor.tsx", import.meta.url), "utf8");
    const visualSettings = readFileSync(new URL("./OperationVisualSettings.tsx", import.meta.url), "utf8");
    expect(editor).toContain("Formato final {preset.aspectWidth}:{preset.aspectHeight}");
    expect(editor).toContain("fitAnalysis?.title");
    expect(editor).toContain("Imagem enviada:");
    expect(editor).toContain("saída exata em");
    expect(editor).toContain("Salvar neste formato");
    expect(visualSettings).toContain('aspectRatio: `${definition.aspectWidth} / ${definition.aspectHeight}`');
    expect(visualSettings).toContain("Tamanho esperado:");
    expect(visualSettings).toContain("se a proporção for diferente, a foto será distorcida");
  });
});
