import { afterEach, describe, expect, it } from "vitest";
import { CSRF_COOKIE } from "../netlify/functions/_shared/session-security";
import { guardBffRequest } from "../netlify/functions/_shared/request-security";

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

function homologationRequest(method: string, headers: HeadersInit = {}) {
  process.env.ADOCE_DEPLOY_ENV = "homologation";
  process.env.SITE_URL = "https://homologacao.example";
  return new Request("https://homologacao.example/api/auth-bff-logout", {
    method,
    headers,
  });
}

describe("guard central dos BFFs", () => {
  it("libera somente método e origem explicitamente autorizados", () => {
    const request = homologationRequest("POST", {
      Origin: "https://homologacao.example",
    });

    expect(
      guardBffRequest(request, {
        methods: ["POST"],
        configuredSiteUrl: process.env.SITE_URL,
      }),
    ).toBeNull();
  });

  it("rejeita método fora da lista com resposta JSON segura", async () => {
    const response = guardBffRequest(
      homologationRequest("DELETE", {
        Origin: "https://homologacao.example",
      }),
      { methods: ["POST"] },
    );

    expect(response?.status).toBe(405);
    expect(response?.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response?.headers.get("x-frame-options")).toBe("DENY");
    expect(await response?.json()).toMatchObject({ code: "method_not_allowed" });
  });

  it("nega preflight CORS e não publica cabeçalhos permissivos", async () => {
    const response = guardBffRequest(
      homologationRequest("OPTIONS", {
        Origin: "https://homologacao.example",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "x-csrf-token",
      }),
      { methods: ["POST"] },
    );

    expect(response?.status).toBe(403);
    expect(response?.headers.has("access-control-allow-origin")).toBe(false);
    expect(response?.headers.has("access-control-allow-credentials")).toBe(false);
    expect(await response?.json()).toMatchObject({ code: "cors_preflight_denied" });
  });

  it("falha fechado para origem divergente", async () => {
    const response = guardBffRequest(
      homologationRequest("POST", {
        Origin: "https://operacao.adocebrigaderia.com.br",
      }),
      { methods: ["POST"] },
    );

    expect(response?.status).toBe(403);
    expect(await response?.json()).toMatchObject({ code: "origin_not_allowed" });
  });

  it("aplica double-submit CSRF somente quando solicitado", async () => {
    const token = "a".repeat(64);
    const invalid = guardBffRequest(
      homologationRequest("POST", {
        Origin: "https://homologacao.example",
        Cookie: `${CSRF_COOKIE}=${token}`,
        "X-CSRF-Token": "b".repeat(64),
      }),
      { methods: ["POST"], requireCsrf: true },
    );
    const valid = guardBffRequest(
      homologationRequest("POST", {
        Origin: "https://homologacao.example",
        Cookie: `${CSRF_COOKIE}=${token}`,
        "X-CSRF-Token": token,
      }),
      { methods: ["POST"], requireCsrf: true },
    );

    expect(invalid?.status).toBe(403);
    expect(await invalid?.json()).toMatchObject({ code: "csrf_validation_failed" });
    expect(valid).toBeNull();
  });

  it("rejeita configuração vazia ou composta apenas por OPTIONS", () => {
    const request = homologationRequest("POST", {
      Origin: "https://homologacao.example",
    });

    expect(() => guardBffRequest(request, { methods: [] })).toThrow(TypeError);
    expect(() => guardBffRequest(request, { methods: ["OPTIONS"] })).toThrow(
      TypeError,
    );
  });
});
