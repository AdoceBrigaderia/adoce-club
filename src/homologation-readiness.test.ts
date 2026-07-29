import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildHomologationReadiness } from "../netlify/functions/_shared/homologation-readiness";

const homologationOrigin = "https://adoce-homologacao.netlify.app";

const baseEnvironment = {
  ADOCE_DEPLOY_ENV: "homologation",
  ADOCE_HOMOLOGATION_SUPABASE_REF: "homolog-project",
  ADOCE_PRODUCTION_SUPABASE_REF: "production-project",
  SITE_URL: homologationOrigin,
  READINESS_REQUEST_ORIGIN: homologationOrigin,
  BFF_ALLOWED_ORIGINS: homologationOrigin,
  VITE_SUPABASE_URL: "https://homolog-project.supabase.co",
  SUPABASE_URL: "https://homolog-project.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  SUPABASE_SECRET_KEY: "server-only-secret",
  WHATSAPP_OTP_PEPPER: "otp-pepper",
  PUBLIC_RATE_LIMIT_PEPPER: "rate-limit-pepper",
  PASSKEY_RP_ID: "adoce-homologacao.netlify.app",
  PASSKEY_ALLOWED_ORIGINS: homologationOrigin,
  META_WA_ACCESS_TOKEN: "configured",
  META_WA_PHONE_NUMBER_ID: "configured",
  META_WA_WABA_ID: "configured",
  META_WA_APP_SECRET: "configured",
  META_WA_VERIFY_TOKEN: "configured",
  META_WA_AUTH_TEMPLATE_NAME: "configured",
  META_WA_GRAPH_API_VERSION: "v23.0",
  META_WA_ENVIRONMENT: "homologation",
  GOOGLE_WALLET_ISSUER_ID: "configured",
  GOOGLE_WALLET_CLASS_ID: "configured",
  GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "configured",
  GOOGLE_WALLET_PRIVATE_KEY: "configured",
  GOOGLE_WALLET_ORIGINS: homologationOrigin,
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
    expect(result.site.allowedOriginsSafe).toBe(true);
    expect(result.supabase.projectRef).toBe("homolog-project");
    expect(result.security.configured).toBe(true);
    expect(result.integrations.passkeys.configured).toBe(true);
    expect(result.integrations.passkeys.rpIdMatches).toBe(true);
    expect(result.integrations.metaWhatsApp.configured).toBe(true);
    expect(result.integrations.metaWhatsApp.environmentMatches).toBe(true);
    expect(result.integrations.metaWhatsApp.graphVersionValid).toBe(true);
    expect(result.integrations.googleWallet.configured).toBe(true);
    expect(result.integrations.googleWallet.originAllowed).toBe(true);
    expect(JSON.stringify(result)).not.toContain("server-only-secret");
    expect(JSON.stringify(result)).not.toContain("otp-pepper");
    expect(JSON.stringify(result)).not.toContain("rate-limit-pepper");
    expect(JSON.stringify(result)).not.toContain('META_WA_ACCESS_TOKEN":"configured');
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
    expect(result.site.allowedOriginsSafe).toBe(false);
    expect(result.supabase.isolated).toBe(false);
  });

  it("bloqueia origem produtiva escondida como entrada adicional do BFF", () => {
    const result = buildHomologationReadiness({
      ...baseEnvironment,
      BFF_ALLOWED_ORIGINS: `${homologationOrigin},https://www.adocebrigaderia.com.br`,
    });
    expect(result.coreReady).toBe(false);
    expect(result.site.allowedByBff).toBe(true);
    expect(result.site.allowedOriginsSafe).toBe(false);
    expect(result.site.productionAllowedOrigins).toBe(1);
    expect(result.site.productionDomainRejected).toBe(false);
  });

  it("bloqueia SITE_URL e listas com caminho ou protocolo inseguro", () => {
    const result = buildHomologationReadiness({
      ...baseEnvironment,
      SITE_URL: `${homologationOrigin}/rota?teste=1`,
      BFF_ALLOWED_ORIGINS: `${homologationOrigin},http://localhost:5173`,
    });
    expect(result.coreReady).toBe(false);
    expect(result.site.validHomologationOrigin).toBe(false);
    expect(result.site.allowedOriginsSafe).toBe(false);
    expect(result.site.invalidAllowedOrigins).toBe(1);
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

  it("distingue núcleo funcional de integrações totalmente ausentes", () => {
    const result = buildHomologationReadiness({
      ...baseEnvironment,
      META_WA_ACCESS_TOKEN: "",
      META_WA_PHONE_NUMBER_ID: "",
      META_WA_WABA_ID: "",
      META_WA_APP_SECRET: "",
      META_WA_VERIFY_TOKEN: "",
      META_WA_AUTH_TEMPLATE_NAME: "",
      GOOGLE_WALLET_ISSUER_ID: "",
      GOOGLE_WALLET_CLASS_ID: "",
      GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "",
      GOOGLE_WALLET_PRIVATE_KEY: "",
      PASSKEY_ALLOWED_ORIGINS: "",
    });
    expect(result.coreReady).toBe(true);
    expect(result.integrations.metaWhatsApp.configured).toBe(false);
    expect(result.integrations.metaWhatsApp.partiallyConfigured).toBe(false);
    expect(result.integrations.googleWallet.configured).toBe(false);
    expect(result.integrations.googleWallet.partiallyConfigured).toBe(false);
    expect(result.integrations.passkeys.configured).toBe(false);
    expect(result.integrations.metaWhatsApp.missing).toContain(
      "META_WA_ACCESS_TOKEN",
    );
  });

  it("identifica Meta parcialmente configurada e ambiente ou versão incorretos", () => {
    const result = buildHomologationReadiness({
      ...baseEnvironment,
      META_WA_PHONE_NUMBER_ID: "",
      META_WA_ENVIRONMENT: "production",
      META_WA_GRAPH_API_VERSION: "latest",
    });
    expect(result.coreReady).toBe(true);
    expect(result.integrations.metaWhatsApp.configured).toBe(false);
    expect(result.integrations.metaWhatsApp.partiallyConfigured).toBe(true);
    expect(result.integrations.metaWhatsApp.environmentMatches).toBe(false);
    expect(result.integrations.metaWhatsApp.graphVersionValid).toBe(false);
    expect(result.integrations.metaWhatsApp.missing).toContain(
      "META_WA_PHONE_NUMBER_ID",
    );
  });

  it("identifica Wallet parcial ou ligado a origem divergente", () => {
    const partial = buildHomologationReadiness({
      ...baseEnvironment,
      GOOGLE_WALLET_PRIVATE_KEY: "",
    });
    expect(partial.coreReady).toBe(true);
    expect(partial.integrations.googleWallet.configured).toBe(false);
    expect(partial.integrations.googleWallet.partiallyConfigured).toBe(true);

    const divergent = buildHomologationReadiness({
      ...baseEnvironment,
      GOOGLE_WALLET_ORIGINS: "https://outro-site.netlify.app",
    });
    expect(divergent.coreReady).toBe(true);
    expect(divergent.integrations.googleWallet.configured).toBe(false);
    expect(divergent.integrations.googleWallet.originAllowed).toBe(false);
  });

  it("bloqueia passkey com RP ID divergente ou origem produtiva", () => {
    const result = buildHomologationReadiness({
      ...baseEnvironment,
      PASSKEY_RP_ID: "outro-site.netlify.app",
      PASSKEY_ALLOWED_ORIGINS: `${homologationOrigin},https://clube.adocebrigaderia.com.br`,
    });
    expect(result.coreReady).toBe(true);
    expect(result.integrations.passkeys.configured).toBe(false);
    expect(result.integrations.passkeys.rpIdMatches).toBe(false);
    expect(result.integrations.passkeys.originsSafe).toBe(false);
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
