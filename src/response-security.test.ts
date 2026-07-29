import { describe, expect, it } from "vitest";
import {
  secureEmpty,
  secureRedirect,
  secureResponseHeaders,
  secureText,
} from "../netlify/functions/_shared/response-security";

const requiredHeaders = {
  "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-permitted-cross-domain-policies": "none",
  "referrer-policy": "no-referrer",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-site",
} as const;

function varyTokens(headers: Headers) {
  return (headers.get("vary") || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function expectSecureHeaders(headers: Headers) {
  Object.entries(requiredHeaders).forEach(([name, value]) => {
    expect(headers.get(name)).toBe(value);
  });
  expect(headers.get("cache-control")).toBe("no-store, max-age=0");
  expect(headers.get("pragma")).toBe("no-cache");
  expect(headers.get("content-security-policy")).toContain("default-src 'none'");
  expect(headers.get("content-security-policy")).toContain(
    "frame-ancestors 'none'",
  );
  expect(varyTokens(headers)).toEqual(
    expect.arrayContaining(["Origin", "Sec-Fetch-Site"]),
  );
}

describe("fronteira segura para respostas não JSON", () => {
  it("protege texto sem permitir downgrade por headers adicionais", async () => {
    const response = secureText("EVENT_RECEIVED", 202, {
      "X-Frame-Options": "SAMEORIGIN",
      "Cache-Control": "public",
      Vary: "Accept-Encoding",
    });

    expect(response.status).toBe(202);
    expect(await response.text()).toBe("EVENT_RECEIVED");
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(varyTokens(response.headers)).toEqual([
      "Accept-Encoding",
      "Origin",
      "Sec-Fetch-Site",
    ]);
    expectSecureHeaders(response.headers);
  });

  it("protege respostas HEAD sem criar corpo", async () => {
    const response = secureEmpty(503);

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(response.headers.has("content-type")).toBe(false);
    expectSecureHeaders(response.headers);
  });

  it("preserva headers operacionais sem reduzir o baseline", () => {
    const headers = secureResponseHeaders({
      headers: { "Retry-After": "30" },
      vary: "Cookie, Origin, Sec-Fetch-Site",
    });

    expect(headers.get("retry-after")).toBe("30");
    expect(headers.get("vary")).toBe("Cookie, Origin, Sec-Fetch-Site");
    expectSecureHeaders(headers);
  });

  it("compõe Vary de forma determinística e remove duplicidades", () => {
    const headers = secureResponseHeaders({
      headers: { Vary: "accept-encoding, COOKIE, origin" },
      vary: "Cookie, Origin",
    });

    expect(headers.get("vary")).toBe(
      "Cookie, Origin, Accept-Encoding, Sec-Fetch-Site",
    );
    expect(new Set(varyTokens(headers)).size).toBe(varyTokens(headers).length);
    expectSecureHeaders(headers);
  });

  it("não permite que um Vary customizado remova as fronteiras de origem", () => {
    const headers = secureResponseHeaders({
      headers: { Vary: "Accept-Language" },
    });

    expect(varyTokens(headers)).toEqual([
      "Accept-Language",
      "Origin",
      "Sec-Fetch-Site",
    ]);
    expectSecureHeaders(headers);
  });

  it("ignora wildcard e tokens inválidos de Vary", () => {
    const headers = secureResponseHeaders({
      headers: { Vary: "*, bad token, accept-encoding, ORIGIN" },
    });

    expect(varyTokens(headers)).toEqual([
      "Accept-Encoding",
      "Origin",
      "Sec-Fetch-Site",
    ]);
    expectSecureHeaders(headers);
  });

  it("protege redirects internos com o mesmo baseline", () => {
    const response = secureRedirect("/entrar?next=%2Foperacao", 303);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/entrar?next=%2Foperacao");
    expectSecureHeaders(response.headers);
  });

  it("rejeita open redirect e status que não sejam de redirecionamento", () => {
    expect(() => secureRedirect("https://evil.example")).toThrow(TypeError);
    expect(() => secureRedirect("//evil.example")).toThrow(TypeError);
    expect(() => secureRedirect("/entrar", 200)).toThrow(RangeError);
  });
});
