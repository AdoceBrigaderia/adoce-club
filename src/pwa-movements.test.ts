import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const accessApp = readFileSync(resolve(root, "src/AccessApp.tsx"), "utf8");

describe("instalação e movimentações amigáveis", () => {
  it("mantém ícones separados e válidos para cliente e operação", () => {
    for (const app of ["clube", "operacao"]) {
      expect(existsSync(resolve(root, `public/pwa/${app}/icon-192.png`))).toBe(true);
      expect(existsSync(resolve(root, `public/pwa/${app}/icon-512.png`))).toBe(true);
      expect(existsSync(resolve(root, `public/pwa/${app}/apple-touch-icon.png`))).toBe(true);
    }
    const clientManifest = readFileSync(resolve(root, "public/manifest-clube.webmanifest"), "utf8");
    const operationManifest = readFileSync(resolve(root, "public/manifest-operacao.webmanifest"), "utf8");
    expect(clientManifest).toContain("/pwa/clube/icon-512.png");
    expect(operationManifest).toContain("/pwa/operacao/icon-512.png");
    expect(clientManifest).not.toContain("logo-original.png");
    expect(operationManifest).not.toContain("logo-original.png");
  });

  it("orienta iPhone e Android conforme o aparelho", () => {
    expect(accessApp).toContain('type InstallPlatform = "ios" | "android" | "desktop"');
    expect(accessApp).toContain("Adicionar à Tela de Início");
    expect(accessApp).toContain("Instalar app");
    expect(accessApp).toContain("Primeiro abra esta página no Safari");
  });

  it("busca somente os perfis relacionados e apresenta movimentos em português", () => {
    expect(accessApp).toContain('.from("ledger_entries")');
    expect(accessApp).toContain('.from("profiles")');
    expect(accessApp).toContain("Compra registrada");
    expect(accessApp).toContain("Fatia grátis retirada");
    expect(accessApp).toContain("customer_first_name");
  });
});
