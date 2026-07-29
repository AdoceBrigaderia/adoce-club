import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  SESSION_MODE_COOKIE,
  clearedSessionCookies,
  secureJson,
  sessionCookies,
  validCsrf,
} from "../netlify/functions/_shared/session-security";
import { readBffCsrfToken } from "./services/bff-auth";

const loginSource = readFileSync(
  new URL("../netlify/functions/auth-bff-login.ts", import.meta.url),
  "utf8",
);
const sessionSource = readFileSync(
  new URL("../netlify/functions/auth-bff-session.ts", import.meta.url),
  "utf8",
);
const logoutSource = readFileSync(
  new URL("../netlify/functions/auth-bff-logout.ts", import.meta.url),
  "utf8",
);

describe("sessão BFF protegida", () => {
  it("emite tokens somente em cookies HttpOnly Secure", () => {
    const issued = sessionCookies(
      {
        access_token: "access-secret",
        refresh_token: "refresh-secret",
        expires_in: 3600,
      },
      "operation",
      true,
      "a".repeat(64),
    );
    const access = issued.values.find((value) => value.startsWith(`${ACCESS_COOKIE}=`));
    const refresh = issued.values.find((value) => value.startsWith(`${REFRESH_COOKIE}=`));
    const csrf = issued.values.find((value) => value.startsWith(`${CSRF_COOKIE}=`));
    const sessionMode = issued.values.find((value) =>
      value.startsWith(`${SESSION_MODE_COOKIE}=`),
    );

    expect(access).toContain("HttpOnly");
    expect(refresh).toContain("HttpOnly");
    expect(access).toContain("Secure");
    expect(refresh).toContain("SameSite=Lax");
    expect(csrf).toContain("SameSite=Strict");
    expect(csrf).not.toContain("HttpOnly");
    expect(sessionMode).toContain("HttpOnly");
    expect(sessionMode).toContain("remembered");
    expect(issued.values.join("\n")).not.toContain("Domain=");
  });

  it("preserva a duração curta ao rotacionar uma sessão não lembrada", () => {
    const shortSession = sessionCookies(
      {
        access_token: "access-secret",
        refresh_token: "refresh-secret",
        expires_in: 900,
      },
      "client",
      false,
      "e".repeat(64),
    );
    expect(shortSession.values.join("\n")).toContain(
      `${SESSION_MODE_COOKIE}=session`,
    );
    expect(sessionSource).toContain(
      'cookies.get(SESSION_MODE_COOKIE) === "remembered"',
    );
    expect(sessionSource).toContain(
      "sessionCookies(rotated, surface as AuthSurface, remembered)",
    );
    expect(sessionSource).not.toContain(
      "sessionCookies(rotated, surface as AuthSurface, true)",
    );
  });

  it("exige double-submit CSRF no logout", () => {
    const token = "b".repeat(64);
    const valid = new Request("https://operacao.adocebrigaderia.com.br/api/auth-bff-logout", {
      method: "POST",
      headers: {
        Cookie: `${CSRF_COOKIE}=${token}`,
        "X-CSRF-Token": token,
      },
    });
    const invalid = new Request("https://operacao.adocebrigaderia.com.br/api/auth-bff-logout", {
      method: "POST",
      headers: {
        Cookie: `${CSRF_COOKIE}=${token}`,
        "X-CSRF-Token": "c".repeat(64),
      },
    });
    expect(validCsrf(valid)).toBe(true);
    expect(validCsrf(invalid)).toBe(false);
  });

  it("remove integralmente os cookies no logout", () => {
    const cleared = clearedSessionCookies();
    expect(cleared).toHaveLength(5);
    cleared.forEach((value) => {
      expect(value).toContain("Max-Age=0");
      expect(value).toContain("Secure");
      expect(value).toContain("Path=/");
    });
  });

  it("protege respostas JSON diretamente na Function", () => {
    const response = secureJson({ ok: true });

    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-permitted-cross-domain-policies")).toBe("none");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("permissions-policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()",
    );
    expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-site");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers.get("vary")).toContain("Sec-Fetch-Site");
  });

  it("o cliente lê apenas o token CSRF, nunca o token de sessão", () => {
    expect(readBffCsrfToken(`${CSRF_COOKIE}=${"d".repeat(64)}; outro=1`)).toBe(
      "d".repeat(64),
    );
    expect(readBffCsrfToken("outro=1")).toBe("");
  });

  it("não devolve access token ou refresh token no corpo do login BFF", () => {
    expect(loginSource).not.toContain("...tokenPayload");
    expect(loginSource).not.toContain("access_token: tokenPayload");
    expect(loginSource).not.toContain("refresh_token: tokenPayload");
    expect(loginSource).toContain("sessionCookies(");
    expect(loginSource).toContain("temporary_password_expired");
  });

  it("restaura, rotaciona e revoga sessões no servidor", () => {
    expect(sessionSource).toContain("grant_type=refresh_token");
    expect(sessionSource).toContain("clearedSessionCookies()");
    expect(logoutSource).toContain("validCsrf(request)");
    expect(logoutSource).toContain("logout?scope=global");
    expect(logoutSource).toContain("clearedSessionCookies()");
  });
});
