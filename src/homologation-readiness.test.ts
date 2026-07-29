import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildHomologationReadiness } from "../netlify/functions/_shared/homologation-readiness";

const baseEnvironment = {
  ADOCE_DEPLOY_ENV: "homologation",
  ADOCE_HOMOLOGATION_SUPABASE_REF: "homolog-project",
  ADOCE_PRODUCTION_SUPABASE_REF: "production-project",
  SITE_URL: "https://adoce-homologacao.netlify.app",
  READINESS_REQUEST_ORIGIN: "https://adoce-homologacao.netlify.app",
  BFF_ALLOWED_ORIGINS: "https://adoce-homologacao.netlify.app",
  VITE_SUPABASE_URL: "https://homolog-project.supabase.co",
  SUPABASE_URL: "https://homolog-project.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  SUPABASE_SECRET_KEY: "server-only-secret",
  WHATSAPP_OTP_PEPPER: "otp-pepper",
  PUBLIC_RATE_LIMIT_PEPPER: "rate-limit-pepper",
  PASSKEY_RP_ID: "adoce-homologacao.netlify.app",
  PASSKEY_ALLOWED_ORIGINS: "https://adoce-homologacao.netlify.app",
  META_WA_ACCESS_TOKEN: "configured",
  META_WA_PHONE_NUMBER_ID: "configured",
  META_WA_WABA_ID: "configured",
  META_WA_APP_SECRET: "configured",
  META_WA_VERIFY_TOKEN: "configured",
  META_WA_AUTH_TEMPLATE_NAME: "configured",
  META_WA_GRAPH_API_VERSION: "v23.0",
  GOOGLE_WALLET_ISSUER_ID: "configured",
  GOOGLE_WALLET_CLASS_ID: "configured",
  GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "configured",
  GOOGLE_WALLET_PRIVATE_KEY: "configured",
  COMMIT_REF: "1234567890abcdef",
  CONTEXT: "deploy-preview",
};

describe("diagnóstico seguro da homologação", () => {
  it("aprova o núcleo isolado e não devolve valores secretos", () => {
    const result = buildHomologationReadiness(
      baseEnvironment,
      new Date("2026-07-27T00:00:00.000Z"),
    );
    expect(result.exposed).toBe(true);
    expect(result.coreReady).toBe(true);
    expect(result.site.requestMatchesConfiguredSite).toBe(true);
    expect(result.supabase.projectRef).toBe("homolog-project");
    expect(result.security.configured).toBe(true);
    expect(result.integrations.passkeys.configured).toBe(true);
    expect(result.integrations.metaWhatsApp.configured).toBe(true);
    expect(result.integrations.googleWallet.configured).toBe(true);
    expect(JSON.stringify(result)).not.toContain("server-only-secret");
    expect(JSON.stringify(result)).not.toContain("otp-pepper");
    expect(JSON.stringify(result)).not.toContain("rate-limit-pepper");
    expect(JSON.stringify(result)).not.toContain("META_WA_ACCESS_TOKEN\":\"configured");
  });

  it("não expõe readiness fora da homologação", () => {
    const result = buildHomologationReadiness({
      ...baseEnvironment,
      ADOCE_DEPLOY_ENV: "production",
    });
    expect(result.exposed).toBe(false);
    expect(result.coreReady).toBe(false);
  });

  it("bloqueia domínio ou Supabase de produção", () => {
    const result = buildHomologationReadiness({
      ...baseEnvironment,
      SITE_URL: "https://www.adocebrigaderia.com.br",
      READINESS_REQUEST_ORIGIN: "https://www.adocebrigaderia.com.br",
      BFF_ALLOWED_ORIGINS: "https://www.adocebrigaderia.com.br",
      VITE_SUPABASE_URL: "https://production-project.supabase.co",
      SUPABASE_URL: "https://production-project.supabase.co",
    });
    expect(result.coreReady).toBe(false);
    expect(result.site.validHomologationOrigin).toBe(false);
    expect(result.site.productionDomainRejected).toBe(false);
    expect(result.supabase.isolated).toBe(false);
  });

  it("aceita somente alias de deploy pertencente ao site de homologação", () => {
    const result = buildHomologationReadiness({
      ...baseEnvironment,
      READINESS_REQUEST_ORIGIN:
        "https://homologacao-adoce--adoce-homologacao.netlify.app",
    });
    expect(result.coreReady).toBe(true);
    expect(result.site.requestOriginValid).toBe(true);
    expect(result.site.requestMatchesConfiguredSite).toBe(true);
  });

  it("bloqueia preview pertencente a outro site Netlify", () => {
    const result = buildHomologationReadiness({
      ...baseEnvironment,
      READINESS_REQUEST_ORIGIN:
        "https://homologacao-adoce--outro-site.netlify.app",
    });
    expect(result.coreReady).toBe(false);
    expect(result.site.requestMatchesConfiguredSite).toBe(false);
  });

  it("bloqueia o núcleo quando peppers obrigatórios estão ausentes", () => {
    const result = buildHomologationReadiness({
      ...baseEnvironment,
      WHATSAPP_OTP_PEPPER: "",
      PUBLIC_RATE_LIMIT_PEPPER: "",
    });
    expect(result.coreReady).toBe(false);
    expect(result.security.configured).toBe(false);
    expect(result.security.missing).toEqual([
      "WHATSAPP_OTP_PEPPER",
      "PUBLIC_RATE_LIMIT_PEPPER",
    ]);
  });

  it("distingue núcleo funcional de integrações ainda sem credenciais", () => {
    const result = buildHomologationReadiness({
      ...baseEnvironment,
      META_WA_ACCESS_TOKEN: "",
      GOOGLE_WALLET_PRIVATE_KEY: "",
      PASSKEY_ALLOWED_ORIGINS: "",
    });
    expect(result.coreReady).toBe(true);
    expect(result.integrations.metaWhatsApp.configured).toBe(false);
    expect(result.integrations.googleWallet.configured).toBe(false);
    expect(result.integrations.passkeys.configured).toBe(false);
    expect(result.integrations.metaWhatsApp.missing).toContain(
      "META_WA_ACCESS_TOKEN",
    );
  });

  it("mantém endpoint ausente em produção e sem listagem de segredos", () => {
    const endpoint = readFileSync(
      new URL("../netlify/functions/homologation-readiness.ts", import.meta.url),
      "utf8",
    );
    expect(endpoint).toContain("if (!readiness.exposed)");
    expect(endpoint).toContain('return secureJson({ error: "Recurso não encontrado." }, 404)');
    expect(endpoint).toContain('"WHATSAPP_OTP_PEPPER"');
    expect(endpoint).toContain('"PUBLIC_RATE_LIMIT_PEPPER"');
    expect(endpoint).toContain("READINESS_REQUEST_ORIGIN: requestOrigin");
    expect(endpoint).not.toContain("accessToken:");
    expect(endpoint).not.toContain("privateKey:");
  });
});
