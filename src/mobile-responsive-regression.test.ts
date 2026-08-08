import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const main = readFileSync("src/main.tsx", "utf8");
const fixes = readFileSync("src/mobile-responsive-fixes.css", "utf8");
const pageFixes = readFileSync("src/mobile-page-layout-fixes.css", "utf8");
const landing = readFileSync("src/MarketingLanding.tsx", "utf8");

describe("responsividade móvel do Portal Adoce", () => {
  it("carrega as correções depois dos estilos antigos", () => {
    expect(main).toContain('import "./mobile-responsive-fixes.css"');
    expect(main).toContain('import "./mobile-page-layout-fixes.css"');
    expect(main.indexOf('import "./mobile-responsive-fixes.css"')).toBeGreaterThan(
      main.indexOf('import "./theme.css"'),
    );
    expect(main.indexOf('import "./mobile-page-layout-fixes.css"')).toBeGreaterThan(
      main.indexOf('import "./mobile-responsive-fixes.css"'),
    );
  });

  it("impede o hero público de ultrapassar celulares", () => {
    expect(landing).toContain('className="brand-hero"');
    expect(fixes).toContain(".public-site");
    expect(fixes).toContain("overflow-x: clip");
    expect(fixes).toContain(".brand-hero-copy h1");
    expect(fixes).toContain("white-space: normal");
    expect(fixes).toContain("text-wrap: balance");
    expect(fixes).toContain(".brand-hero-copy h1 br");
    expect(fixes).toContain("display: none");
    expect(pageFixes).toContain("font-size: clamp(2.7rem, 11.8vw, 3.6rem)");
    expect(pageFixes).toContain("grid-template-columns: minmax(0, 1fr) !important");
  });

  it("mantém ações e provas sociais dentro da largura disponível", () => {
    expect(fixes).toContain(".public-actions");
    expect(fixes).toContain("repeat(2, minmax(0, 1fr))");
    expect(fixes).toContain(".public-primary,");
    expect(fixes).toContain("width: 100%");
    expect(fixes).toContain(".home-proof-strip");
  });

  it("empilha cadastro clube encomendas e pede junto", () => {
    expect(pageFixes).toContain(".join-form-wrap");
    expect(pageFixes).toContain(".wallet-card");
    expect(pageFixes).toContain("aspect-ratio: auto");
    expect(pageFixes).toContain(".identity-panel .qr");
    expect(pageFixes).toContain(".group-order-hero");
    expect(pageFixes).toContain(".cake-order-hero");
    expect(pageFixes).toContain("max-width: 100vw");
  });

  it("respeita áreas seguras de iOS e continua touch-first", () => {
    expect(fixes).toContain("env(safe-area-inset-right)");
    expect(fixes).toContain("env(safe-area-inset-bottom)");
    expect(fixes).toContain("env(safe-area-inset-left)");
    expect(fixes).toContain("min-height: 50px");
  });
});
