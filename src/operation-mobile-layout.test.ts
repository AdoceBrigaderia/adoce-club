import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const mobile = readFileSync("src/adoce-mobile-first-2026.css", "utf8");
const operation = readFileSync("src/operation-v3.css", "utf8");
const commercial = readFileSync("src/OperationCommercialAdmin.tsx", "utf8");
const instant = readFileSync("src/OperationInstantOrders.tsx", "utf8");
const access = readFileSync("src/AccessApp.tsx", "utf8");

describe("operação em 360 px", () => {
  it("faz o menu Mais ocupar a viewport dinâmica e rolar até o fim", () => {
    expect(mobile).toContain("min-height: 100dvh");
    expect(mobile).toContain("padding: 20px 20px calc(72px + env(safe-area-inset-bottom, 0px))");
    expect(mobile).toContain("overflow-y: auto");
    expect(mobile).toContain("grid-template-columns: 24px minmax(0, 1fr)");
  });

  it("transforma tabelas financeiras em cartões e preserva Líquido", () => {
    expect(operation).toContain(".commerce-tool-card table,");
    expect(operation).toContain(".commerce-tool-card td::before");
    expect(operation).toContain(".commerce-tool-card td.net");
    expect(operation).toContain("@media (min-width: 721px)");
  });

  it("mantém um único cabeçalho e botão Atualizar na tela de vendas", () => {
    expect(commercial.match(/className="commercial-refresh"/g)).toHaveLength(1);
    expect(instant).toContain("instant-order-subheading");
    expect(instant).not.toContain("commercial-refresh");
  });

  it("usa Inter e algarismos tabulares nos números de operação", () => {
    expect(operation).toContain("font-family: Inter, sans-serif");
    expect(operation).toContain("font-variant-numeric: tabular-nums");
  });

  it("preserva a leitura da agenda e do painel lateral em tablets", () => {
    expect(operation).toContain("@media (min-width: 621px) and (max-width: 1366px)");
    expect(operation).toContain("width: min(620px, 72vw)");
    expect(operation).toContain("scroll-snap-type: x proximity");
    expect(operation).toContain("@media (min-width: 901px) and (max-width: 1366px)");
    expect(operation).toContain("grid-template-columns: 92px minmax(0, 1fr)");
  });

  it("oferece retorno global nas telas internas da operacao", () => {
    expect(access).toContain('className="operation-back-button"');
    expect(access).toContain("goBackInOperation");
    expect(access).toContain("operationNavigationHistoryRef.current.pop()");
    expect(access).toContain("if (selected)");
    expect(operation).toContain(".operation-back-bar");
    expect(operation).toContain("min-height: 44px");
  });
});
