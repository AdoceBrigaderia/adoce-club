import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const start = readFileSync(
  new URL("../netlify/functions/auth-bff-passkey-start.ts", import.meta.url),
  "utf8",
);
const finish = readFileSync(
  new URL("../netlify/functions/auth-bff-passkey-finish.ts", import.meta.url),
  "utf8",
);
const client = readFileSync(
  new URL("./services/bff-passkeys.ts", import.meta.url),
  "utf8",
);

describe("passkeys protegidas pelo BFF", () => {
  it("não devolve tokens ao JavaScript", () => {
    expect(finish).toContain("sessionCookies(tokens");
    expect(finish).not.toContain("accessToken: tokens.access_token");
    expect(finish).not.toContain("refreshToken: tokens.refresh_token");
    expect(client).not.toContain("localStorage");
    expect(client).not.toContain("sessionStorage");
    expect(client).not.toContain("Authorization");
  });

  it("exige sessão e CSRF para cadastrar nova chave", () => {
    expect(start).toContain('action === "registration"');
    expect(start).toContain("guardBffCsrf(request)");
    expect(start).toContain("ACCESS_COOKIE");
    expect(finish).toContain("guardBffCsrf(request)");
    expect(finish).toContain("ACCESS_COOKIE");
    expect(start).not.toContain("validCsrf(request)");
    expect(finish).not.toContain("validCsrf(request)");
  });

  it("centraliza método e origem e rejeita ações desconhecidas", () => {
    [start, finish].forEach((source) => {
      expect(source).toContain("guardBffRequest(request");
      expect(source).toContain('methods: ["POST"]');
      expect(source).toContain('configuredSiteUrl: env("SITE_URL")');
      expect(source).not.toContain("allowedOrigin(request");
    });
    expect(finish).toContain('["authentication", "registration"].includes(action)');
  });

  it("valida perfil e acesso operacional antes dos cookies", () => {
    expect(finish).toContain('.from("profiles")');
    expect(finish).toContain('.from("staff_members")');
    expect(finish).toContain("Esta chave não possui acesso à operação");
    expect(finish.indexOf("staff_members")).toBeLessThan(
      finish.indexOf("sessionCookies(tokens"),
    );
  });

  it("serializa a cerimônia WebAuthn no navegador", () => {
    expect(client).toContain("navigator.credentials.get");
    expect(client).toContain("navigator.credentials.create");
    expect(client).toContain("AuthenticatorAssertionResponse");
    expect(client).toContain("AuthenticatorAttestationResponse");
    expect(client).toContain("clientExtensionResults");
  });
});
