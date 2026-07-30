import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const netlifyConfig = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function contentSecurityPolicy() {
  const match = netlifyConfig.match(/Content-Security-Policy\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("CSP não encontrada no netlify.toml");
  return match[1];
}

describe("gate de cabeçalhos de segurança", () => {
  it("publica os cabeçalhos obrigatórios", () => {
    expect(netlifyConfig).toContain('Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"');
    expect(netlifyConfig).toContain('X-Content-Type-Options = "nosniff"');
    expect(netlifyConfig).toContain('X-Frame-Options = "DENY"');
    expect(netlifyConfig).toContain('Referrer-Policy = "strict-origin-when-cross-origin"');
    expect(netlifyConfig).toContain('Cross-Origin-Opener-Policy = "same-origin"');
    expect(netlifyConfig).toContain('Cross-Origin-Resource-Policy = "same-site"');
  });

  it("mantém uma CSP sem execução arbitrária", () => {
    const csp = contentSecurityPolicy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain(
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    );
    expect(csp).toContain("font-src 'self' data: https://fonts.gstatic.com");
    expect(csp).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    expect(csp).toContain("frame-src https://www.instagram.com");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp.match(/script-src [^;]+/)?.[0]).not.toContain("'unsafe-inline'");
  });

  it("não mantém JavaScript executável inline no HTML", () => {
    const inlineScripts = [...indexHtml.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
      .filter(([, attributes, body]) => {
        if (/type=["']application\/ld\+json["']/.test(attributes)) return false;
        if (/\bsrc=/.test(attributes)) return false;
        return body.trim().length > 0;
      });

    expect(inlineScripts).toHaveLength(0);
  });

  it("autoriza somente o JSON-LD conhecido pelo hash", () => {
    const match = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const normalizedBody = match![1].replace(/\r\n/g, "\n");
    const knownDigests = [
      normalizedBody,
      normalizedBody.replace(/\n/g, "\r\n"),
    ].map((body) => createHash("sha256").update(body).digest("base64"));
    const authorizedDigests =
      contentSecurityPolicy().match(/'sha256-([^']+)'/g) ?? [];

    expect(authorizedDigests).toHaveLength(knownDigests.length);
    knownDigests.forEach((digest) => {
      expect(authorizedDigests).toContain(`'sha256-${digest}'`);
    });
  });
});
