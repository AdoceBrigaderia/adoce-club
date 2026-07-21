import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clipboardBlobToFile, imageFileFromClipboardItems } from "./ClipboardImageInput";

describe("inclusão de fotos pela área de transferência", () => {
  it("transforma uma imagem colada em arquivo aceito pelo editor", () => {
    const file = clipboardBlobToFile(new Blob(["foto"], { type: "image/png" }), 123);
    expect(file).toMatchObject({ name: "foto-colada-123.png", type: "image/png", lastModified: 123 });
  });

  it("encontra a primeira imagem válida e ignora texto", () => {
    const image = new File(["foto"], "origem.webp", { type: "image/webp" });
    const file = imageFileFromClipboardItems([
      { kind: "string", type: "text/plain", getAsFile: () => null },
      { kind: "file", type: "image/webp", getAsFile: () => image },
    ]);
    expect(file?.type).toBe("image/webp");
    expect(file?.name).toMatch(/^foto-colada-\d+\.webp$/);
  });

  it("recusa formatos que o editor não processa", () => {
    expect(clipboardBlobToFile(new Blob(["svg"], { type: "image/svg+xml" }))).toBeNull();
  });

  it("está disponível em todas as cinco entradas de foto da operação", () => {
    const commercial = readFileSync(new URL("./OperationCommercialAdmin.tsx", import.meta.url), "utf8");
    const content = readFileSync(new URL("./OperationContentAdmin.tsx", import.meta.url), "utf8");
    expect(commercial.match(/<ClipboardImageInput/g)).toHaveLength(2);
    expect(content.match(/<ClipboardImageInput/g)).toHaveLength(3);
    expect(`${commercial}\n${content}`.match(/type="file"/g)).toHaveLength(5);
  });
});
