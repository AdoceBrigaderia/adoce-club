import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const service = readFileSync(
  new URL("../android/app/src/main/java/br/com/adocebrigaderia/operacao/AdoceOrderService.java", import.meta.url),
  "utf8",
);

const writeReceipt = service.slice(
  service.indexOf("private void writeReceipt"),
  service.indexOf("private byte[] receipt"),
);

const webPrinter = readFileSync(
  new URL("./lib/impressora-termica.ts", import.meta.url),
  "utf8",
);

const webTransport = readFileSync(
  new URL("./lib/conexao-bluetooth.ts", import.meta.url),
  "utf8",
);

describe("regra permanente de transporte BLE da KNUP KP-1025", () => {
  it("mantém o limite de 20 bytes e o backpressure entre pacotes", () => {
    expect(writeReceipt).toMatch(/start\s*\+=\s*20/);
    expect(writeReceipt).toMatch(/Math\.min\(20\s*,/);
    expect(writeReceipt).toContain("CountDownLatch");
    expect(writeReceipt).toContain("TimeUnit.SECONDS");
    expect(writeReceipt).toContain("Thread.sleep(35)");
  });

  it("mantem o mesmo limite no caminho Web Bluetooth", () => {
    expect(webPrinter).toMatch(/fatiar\(bytes: Uint8Array, tamanho = 20\)/);
    expect(webPrinter).not.toMatch(/tamanho = 180/);
    expect(webTransport).toContain("fatiar(montarBytes(ficha))");
  });

  it("bloqueia o retorno do transporte quebrado de 180 bytes", () => {
    expect(writeReceipt).not.toMatch(/start\s*\+=\s*180/);
    expect(writeReceipt).not.toMatch(/Math\.min\(180\s*,/);
    expect(webPrinter).not.toMatch(/tamanho\s*=\s*180/);
  });
});
