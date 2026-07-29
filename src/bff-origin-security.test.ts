import { afterEach, describe, expect, it } from "vitest";
import { allowedOrigin } from "../netlify/functions/_shared/session-security";

const originalDeployEnvironment = process.env.ADOCE_DEPLOY_ENV;
const originalAllowedOrigins = process.env.BFF_ALLOWED_ORIGINS;
const originalSiteUrl = process.env.SITE_URL;

afterEach(() => {
  if (originalDeployEnvironment === undefined)
    delete process.env.ADOCE_DEPLOY_ENV;
  else process.env.ADOCE_DEPLOY_ENV = originalDeployEnvironment;

  if (originalAllowedOrigins === undefined)
    delete process.env.BFF_ALLOWED_ORIGINS;
  else process.env.BFF_ALLOWED_ORIGINS = originalAllowedOrigins;

  if (originalSiteUrl === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = originalSiteUrl;
});

describe("origens autorizadas dos BFFs", () => {
  it("exige Origin em requisições mutáveis", () => {
    process.env.ADOCE_DEPLOY_ENV = "homologation";
    const request = new Request("https://homologacao.example/api/auth-bff-login", {
      method: "POST",
    });

    expect(allowedOrigin(request, "https://homologacao.example")).toBe(false);
  });

  it("permite leituras sem Origin para navegação e health checks", () => {
    process.env.ADOCE_DEPLOY_ENV = "homologation";
    const request = new Request("https://homologacao.example/api/health", {
      method: "GET",
    });

    expect(allowedOrigin(request, "https://homologacao.example")).toBe(true);
  });

  it("aceita somente a origem canônica configurada", () => {
    process.env.ADOCE_DEPLOY_ENV = "homologation";
    const allowed = new Request("https://homologacao.example/api/auth-bff-login", {
      method: "POST",
      headers: { Origin: "https://homologacao.example" },
    });
    const rejected = new Request("https://homologacao.example/api/auth-bff-login", {
      method: "POST",
      headers: { Origin: "https://www.adocebrigaderia.com.br" },
    });

    expect(allowedOrigin(allowed, "https://homologacao.example/")).toBe(true);
    expect(allowedOrigin(rejected, "https://homologacao.example/")).toBe(false);
  });

  it("suporta lista explícita de origens sem misturar ambientes", () => {
    process.env.ADOCE_DEPLOY_ENV = "homologation";
    process.env.BFF_ALLOWED_ORIGINS = [
      "https://homologacao.example",
      "https://operacao-homologacao.example",
    ].join(",");
    process.env.SITE_URL = "https://homologacao.example";

    const operation = new Request(
      "https://homologacao.example/api/auth-bff-rpc",
      {
        method: "POST",
        headers: { Origin: "https://operacao-homologacao.example" },
      },
    );
    const production = new Request(
      "https://homologacao.example/api/auth-bff-rpc",
      {
        method: "POST",
        headers: { Origin: "https://operacao.adocebrigaderia.com.br" },
      },
    );

    expect(allowedOrigin(operation)).toBe(true);
    expect(allowedOrigin(production)).toBe(false);
  });

  it("libera localhost apenas em ambiente local de desenvolvimento", () => {
    const request = new Request("http://127.0.0.1:8888/api/auth-bff-login", {
      method: "POST",
      headers: { Origin: "http://localhost:5173" },
    });

    process.env.ADOCE_DEPLOY_ENV = "local";
    expect(allowedOrigin(request)).toBe(true);

    process.env.ADOCE_DEPLOY_ENV = "homologation";
    expect(allowedOrigin(request)).toBe(false);
  });
});
