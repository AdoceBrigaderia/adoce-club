import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const main = readFileSync("src/main.tsx", "utf8");
const fixes = readFileSync("src/mobile-responsive-fixes.css", "utf8");
const landing = readFileSync("src/MarketingLanding.tsx", "utf8");
const navigator = readFileSync("src/HomologationVisualNavigator.tsx", "utf8");

describe("responsividade móvel do Portal Adoce", () => {
  it("carrega as correções depois dos estilos antigos", () => {
    expect(main).toContain('import "./mobile-responsive-fixes.css"');
    expect(main.indexOf('import "./mobile-responsive-fixes.css"')).toBeGreaterThan(
      main.indexOf('import "./theme.css"'),
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
    expect(fixes).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(fixes).toContain("min-height: auto");
  });

  it("mantém ações e provas sociais dentro da largura disponível", () => {
    expect(fixes).toContain(".public-actions");
    expect(fixes).toContain("repeat(2, minmax(0, 1fr))");
    expect(fixes).toContain(".public-primary,");
    expect(fixes).toContain("width: 100%");
    expect(fixes).toContain(".home-proof-strip");
  });

  it("transforma o roteiro aberto em uma folha móvel rolável", () => {
    expect(navigator).toContain("homologation-visual-navigator");
    expect(navigator).toContain("homologation-visual-route-note");
    expect(fixes).toContain(".homologation-visual-navigator.is-open");
    expect(fixes).toContain("100dvh");
    expect(fixes).toContain("overflow-x: hidden");
    expect(fixes).toContain("overflow-y: auto");
    expect(fixes).toContain("overflow-wrap: anywhere");
    expect(fixes).toContain("white-space: pre-wrap");
  });

  it("respeita áreas seguras de iOS e continua touch-first", () => {
    expect(fixes).toContain("env(safe-area-inset-right)");
    expect(fixes).toContain("env(safe-area-inset-bottom)");
    expect(fixes).toContain("env(safe-area-inset-left)");
    expect(fixes).toContain("min-height: 50px");
  });
});
