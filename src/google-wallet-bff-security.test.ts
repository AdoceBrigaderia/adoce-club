import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const endpoint = read("../netlify/functions/google-wallet-pass.ts");
const adapter = read("../netlify/functions/_shared/google-wallet.ts");
const service = read("./services/google-wallet.ts");
const button = read("./CustomerGoogleWalletButton.tsx");
const gateway = read("./PasskeyClientGateway.tsx");

describe("Google Wallet pelo BFF", () => {
  it("exige origem, CSRF, superfície cliente e cookie HttpOnly", () => {
    expect(endpoint).toContain("allowedOrigin(request, siteUrl)");
    expect(endpoint).toContain("validCsrf(request)");
    expect(endpoint).toContain('cookies.get(SURFACE_COOKIE) !== "client"');
    expect(endpoint).toContain("cookies.get(ACCESS_COOKIE)");
    expect(endpoint).toContain('code: "session_refresh_required"');
  });

  it("mantém a chave privada somente no servidor", () => {
    expect(adapter).toContain('readEnv("GOOGLE_WALLET_PRIVATE_KEY")');
    expect(service).not.toContain("GOOGLE_WALLET_PRIVATE_KEY");
    expect(button).not.toContain("GOOGLE_WALLET_PRIVATE_KEY");
    expect(gateway).not.toContain("GOOGLE_WALLET_PRIVATE_KEY");
    expect(endpoint).not.toContain("private_key:");
  });

  it("usa POST same-origin com CSRF e valida o domínio de destino", () => {
    expect(service).toContain('fetch("/api/google-wallet-pass"');
    expect(service).toContain('method: "POST"');
    expect(service).toContain('credentials: "same-origin"');
    expect(service).toContain('"X-CSRF-Token": csrfToken');
    expect(button).toContain('destination.hostname !== "pay.google.com"');
    expect(button).toContain(
      '!destination.pathname.startsWith("/gp/v/save/")',
    );
  });

  it("integra o botão ao cartão real do cliente", () => {
    expect(gateway).toContain(
      'import CustomerGoogleWalletButton from "./CustomerGoogleWalletButton"',
    );
    expect(gateway).toContain(
      "<CustomerGoogleWalletButton onMessage={setMessage} />",
    );
    expect(button).toContain("Adicionar ao Google Wallet");
  });
});
