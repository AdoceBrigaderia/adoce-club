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
const management = readFileSync(
  new URL("../netlify/functions/auth-bff-passkeys.ts", import.meta.url),
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
    expect(start).toContain("validCsrf(request)");
    expect(start).toContain("sessionTokens(request)");
    expect(start).toContain("client.auth.setSession");
    expect(finish).toContain("validCsrf(request)");
    expect(finish).toContain("sessionTokens(request)");
    expect(finish).toContain("client.auth.setSession");
  });

  it("recusa uma sessão incompleta antes de listar ou alterar passkeys", () => {
    expect(management).toContain("sessionTokens(request)");
    expect(management).toContain("client.auth.setSession");
    expect(management).toContain("!sessionTokensForRequest");
    expect(management).toContain("Sessão obrigatória.");
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
