import { afterEach, describe, expect, it } from "vitest";
import { allowedOrigin } from "../netlify/functions/_shared/session-security";

const originalDeployEnvironment = process.env.ADOCE_DEPLOY_ENV;
const originalAllowedOrigins = process.env.BFF_ALLOWED_ORIGINS;
const originalSiteUrl = process.env.SITE_URL;

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore("ADOCE_DEPLOY_ENV", originalDeployEnvironment);
  restore("BFF_ALLOWED_ORIGINS", originalAllowedOrigins);
  restore("SITE_URL", originalSiteUrl);
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

  it("falha fechado quando o ambiente não foi declarado", () => {
    delete process.env.ADOCE_DEPLOY_ENV;
    process.env.BFF_ALLOWED_ORIGINS = "http://localhost:5173";
    const request = new Request("http://localhost:8888/api/auth-bff-login", {
      method: "POST",
      headers: { Origin: "http://localhost:5173" },
    });

    expect(allowedOrigin(request)).toBe(false);
  });

  it("rejeita HTTP remoto mesmo no modo local", () => {
    process.env.ADOCE_DEPLOY_ENV = "local";
    process.env.BFF_ALLOWED_ORIGINS = "http://dev.example";
    const request = new Request("http://dev.example/api/auth-bff-login", {
      method: "POST",
      headers: { Origin: "http://dev.example" },
    });

    expect(allowedOrigin(request)).toBe(false);
  });

  it("rejeita origens configuradas com caminho, credenciais, parâmetros ou fragmento", () => {
    process.env.ADOCE_DEPLOY_ENV = "homologation";
    delete process.env.SITE_URL;
    const request = new Request("https://homologacao.example/api/auth-bff-login", {
      method: "POST",
      headers: { Origin: "https://homologacao.example" },
    });

    for (const invalid of [
      "https://homologacao.example/admin",
      "https://usuario:senha@homologacao.example",
      "https://homologacao.example?origem=liberada",
      "https://homologacao.example#origem",
    ]) {
      process.env.BFF_ALLOWED_ORIGINS = invalid;
      expect(allowedOrigin(request)).toBe(false);
    }
  });

  it("rejeita Origin sintaticamente diferente de uma origem pura", () => {
    process.env.ADOCE_DEPLOY_ENV = "homologation";
    process.env.BFF_ALLOWED_ORIGINS = "https://homologacao.example";

    for (const invalidOrigin of [
      "null",
      "https://homologacao.example/caminho",
      "https://homologacao.example?x=1",
      "https://homologacao.example#x",
    ]) {
      const request = new Request("https://homologacao.example/api/auth-bff-login", {
        method: "POST",
        headers: { Origin: invalidOrigin },
      });
      expect(allowedOrigin(request)).toBe(false);
    }
  });

  it("bloqueia domínios produtivos mesmo quando foram incluídos por engano na homologação", () => {
    process.env.ADOCE_DEPLOY_ENV = "homologation";
    delete process.env.SITE_URL;

    for (const productionOrigin of [
      "https://adocebrigaderia.com.br",
      "https://www.adocebrigaderia.com.br",
      "https://clube.adocebrigaderia.com.br",
      "https://operacao.adocebrigaderia.com.br",
    ]) {
      process.env.BFF_ALLOWED_ORIGINS = productionOrigin;
      const request = new Request(`${productionOrigin}/api/auth-bff-login`, {
        method: "POST",
        headers: { Origin: productionOrigin },
      });
      expect(allowedOrigin(request)).toBe(false);
    }
  });
});
