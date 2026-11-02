import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRODUCTION_SITE_ORIGIN, isAllowedAppOrigin } from "../netlify/functions/_shared/production-origin";
import { buildAccessLink } from "../netlify/functions/_shared/access-link";

describe("migração para Cantinho da Adoce", () => {
  it("gera acessos no novo domínio oficial", () => {
    expect(PRODUCTION_SITE_ORIGIN).toBe("https://www.cantinhodaadoce.com.br");
    expect(buildAccessLink("cliente@example.com", "123456").loginUrl).toBe(
      "https://www.cantinhodaadoce.com.br/clube/acesso-direto?email=cliente%40example.com&code=123456",
    );
  });

  it("aceita o domínio novo e recusa sites externos", () => {
    expect(isAllowedAppOrigin("https://www.cantinhodaadoce.com.br")).toBe(true);
    expect(isAllowedAppOrigin("https://cantinhodaadoce.com.br")).toBe(true);
    expect(isAllowedAppOrigin("https://www.cantinhodaadoce.com.br.evil.example")).toBe(false);
    expect(isAllowedAppOrigin("https://preview.example")).toBe(false);
    expect(() => buildAccessLink("cliente@example.com", "123456", "https://www.cantinhodaadoce.com.br:444")).toThrow();
  });

  it("preserva APIs antes do redirecionamento permanente das páginas antigas", () => {
    const config = readFileSync("netlify.toml", "utf8");
    for (const host of ["adocebrigaderia.com.br", "www.adocebrigaderia.com.br", "cantinhodaadoce.com.br"]) {
      for (const protocol of ["http", "https"]) {
        const source = `from = "${protocol}://${host}/*"`;
        expect(config).toContain(source);
        expect(config.indexOf('from = "/api/*"')).toBeLessThan(config.indexOf(source));
        const rule = config.slice(config.indexOf(source)).split("[[redirects]]")[0];
        expect(rule).toContain('to = "https://www.cantinhodaadoce.com.br/:splat"');
        expect(rule).toContain("status = 301");
        expect(rule).toContain("force = true");
      }
    }
  });
});
