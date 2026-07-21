import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_IMAGE_PRESET,
  PRODUCT_IMAGE_PRESET,
} from "./ImageEditor";

describe("editor de imagens dos produtos", () => {
  it("padroniza produtos e categorias em 4:3 sem esticar", () => {
    expect(PRODUCT_IMAGE_PRESET).toMatchObject({ aspectWidth: 4, aspectHeight: 3, outputWidth: 1200 });
    expect(CATEGORY_IMAGE_PRESET).toMatchObject({ aspectWidth: 4, aspectHeight: 3, outputWidth: 1400 });
  });

  it("oferece enquadramento, toque, comparação e ajustes da foto real", () => {
    const source = readFileSync(new URL("./ImageEditor.tsx", import.meta.url), "utf8");
    expect(source).toContain('type FitMode = "cover" | "contain"');
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
});
