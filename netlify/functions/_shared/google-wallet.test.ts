import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildGoogleWalletObject,
  createGoogleWalletSaveUrl,
  readGoogleWalletConfig,
  safeWalletIdPart,
} from "./google-wallet";

const decode = (value: string) =>
  JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

describe("Google Wallet adapter", () => {
  it("recusa configuração incompleta sem revelar segredos", () => {
    const result = readGoogleWalletConfig((name) =>
      name === "GOOGLE_WALLET_ISSUER_ID" ? "123456789" : undefined,
    );
    expect(result.configured).toBe(false);
    if (result.configured) throw new Error("configuração deveria estar incompleta");
    expect(result.missing).toContain("GOOGLE_WALLET_PRIVATE_KEY");
    expect(JSON.stringify(result)).not.toContain("BEGIN PRIVATE KEY");
  });

  it("normaliza IDs sem dados pessoais legíveis", () => {
    expect(safeWalletIdPart("customer_123e4567-e89b-12d3-a456-426614174000"))
      .toBe("customer_123e4567-e89b-12d3-a456-426614174000");
    expect(safeWalletIdPart(" João da Silva ")).toBe("Joao_da_Silva");
  });

  it("gera objeto de fidelidade com QR apenas identificador", () => {
    const object = buildGoogleWalletObject(
      {
        issuerId: "123456789",
        classId: "123456789.clube_adoce",
        serviceAccountEmail: "wallet@example.iam.gserviceaccount.com",
        privateKey: "unused",
        origins: ["https://homologacao.adocebrigaderia.com.br"],
      },
      {
        profileId: "123e4567-e89b-12d3-a456-426614174000",
        fullName: "Maria da Silva",
        memberCode: "ADOCE-9K2P",
        currentProgress: 16,
        availableRewards: 2,
        objectSuffix: "customer_123e4567e89b12d3a456426614174000",
        logoUri: "https://homologacao.adocebrigaderia.com.br/site/logo.webp",
        accountUri: "https://homologacao.adocebrigaderia.com.br/#minha-conta",
      },
    );
    expect(object.id).toBe(
      "123456789.customer_123e4567e89b12d3a456426614174000",
    );
    expect(object.barcode.value).toBe("adoce-member:ADOCE-9K2P");
    expect(object.textModulesData[0].body).toBe("14 de 14");
    expect(JSON.stringify(object)).not.toContain("123e4567-e89b-12d3-a456-426614174000");
  });

  it("assina JWT RS256 aceito pelo link Save to Google Wallet", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const result = createGoogleWalletSaveUrl(
      {
        issuerId: "123456789",
        classId: "123456789.clube_adoce",
        serviceAccountEmail: "wallet@example.iam.gserviceaccount.com",
        privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
        origins: ["https://homologacao.adocebrigaderia.com.br"],
      },
      {
        profileId: "123e4567-e89b-12d3-a456-426614174000",
        fullName: "Maria da Silva",
        memberCode: "ADOCE-9K2P",
        currentProgress: 8,
        availableRewards: 1,
        objectSuffix: "customer_123e4567e89b12d3a456426614174000",
        logoUri: "https://homologacao.adocebrigaderia.com.br/site/logo.webp",
        accountUri: "https://homologacao.adocebrigaderia.com.br/#minha-conta",
      },
      1_700_000_000,
    );

    expect(result.saveUrl).toBe(`https://pay.google.com/gp/v/save/${result.token}`);
    expect(result.token.length).toBeLessThanOrEqual(1800);

    const [encodedHeader, encodedPayload, encodedSignature] = result.token.split(".");
    expect(decode(encodedHeader)).toEqual({ alg: "RS256", typ: "JWT" });
    const payload = decode(encodedPayload);
    expect(payload.aud).toBe("google");
    expect(payload.typ).toBe("savetowallet");
    expect(payload.origins).toEqual([
      "https://homologacao.adocebrigaderia.com.br",
    ]);
    expect(payload.payload.genericObjects).toHaveLength(1);
    expect(
      verify(
        "RSA-SHA256",
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        publicKey,
        Buffer.from(encodedSignature, "base64url"),
      ),
    ).toBe(true);
  });
});
