import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const clientGateway = readFileSync(
  resolve(root, "src/PasskeyClientGateway.tsx"),
  "utf8",
);
const operationGateway = readFileSync(
  resolve(root, "src/PasskeyOperationGateway.tsx"),
  "utf8",
);

describe("instalação e movimentações amigáveis", () => {
  it("mantém ícones separados e válidos para cliente e operação", () => {
    for (const app of ["clube", "operacao"]) {
      expect(existsSync(resolve(root, `public/pwa/${app}/icon-192.png`))).toBe(
        true,
      );
      expect(existsSync(resolve(root, `public/pwa/${app}/icon-512.png`))).toBe(
        true,
      );
      expect(
        existsSync(resolve(root, `public/pwa/${app}/apple-touch-icon.png`)),
      ).toBe(true);
    }
    const clientManifest = readFileSync(
      resolve(root, "public/manifest-clube.webmanifest"),
      "utf8",
    );
    const operationManifest = readFileSync(
      resolve(root, "public/manifest-operacao.webmanifest"),
      "utf8",
    );
    expect(clientManifest).toContain("/pwa/clube/icon-512.png");
    expect(operationManifest).toContain("/pwa/operacao/icon-512.png");
    expect(clientManifest).not.toContain("logo-original.png");
    expect(operationManifest).not.toContain("logo-original.png");
  });

  it("mantém experiências instaláveis separadas e adequadas ao toque", () => {
    expect(clientGateway).toContain("Clube Adoce");
    expect(clientGateway).toContain("Seu cartão digital");
    expect(clientGateway).toContain("Entrar com biometria");
    expect(operationGateway).toContain("Adoce Operação");
    expect(operationGateway).toContain("Entrar na operação");
    expect(clientGateway).not.toContain("auth.setSession");
    expect(operationGateway).not.toContain("auth.setSession");
  });

  it("apresenta movimentos do cartão em português pelo workspace BFF", () => {
    expect(clientGateway).toContain("customer_get_account_workspace");
    expect(clientGateway).toContain("Compra registrada");
    expect(clientGateway).toContain("Ajuste da Adoce");
    expect(clientGateway).toContain("Fatia grátis resgatada");
  });
});
