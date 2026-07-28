import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const operationPreview = readFileSync(
  "src/HomologationOperationPreview.tsx",
  "utf8",
);
const settings = readFileSync(
  "src/HomologationOperationSettings.tsx",
  "utf8",
);
const styles = readFileSync(
  "src/homologation-operation-settings.css",
  "utf8",
);

describe("configurações visíveis no preview da operação", () => {
  it("expõe uma entrada central de configurações no menu principal", () => {
    expect(operationPreview).toContain('| "settings"');
    expect(operationPreview).toContain('label: "Configurações"');
    expect(operationPreview).toContain(
      'description: "Globais, fotos, custos e tortas"',
    );
    expect(operationPreview).toContain("<HomologationOperationSettings />");
  });

  it("permite revisar configurações globais, fotos, custos e fabricação", () => {
    expect(settings).toContain('id: "global"');
    expect(settings).toContain('id: "photos"');
    expect(settings).toContain('id: "costs"');
    expect(settings).toContain('id: "cakes"');
    expect(settings).toContain("Configurações globais");
    expect(settings).toContain("Fotos e identidade");
    expect(settings).toContain("Custos e margens");
    expect(settings).toContain("Montagem das tortas");
  });

  it("mostra preço, custo, lucro, margem e alertas sem persistir dados", () => {
    expect(settings).toContain("Custo");
    expect(settings).toContain("Venda");
    expect(settings).toContain("Lucro");
    expect(settings).toContain("Margem");
    expect(settings).toContain("Margem mínima");
    expect(settings).toContain("nenhuma alteração foi gravada");
    expect(operationPreview).toContain(
      "nenhuma venda, configuração, foto, carimbo ou movimento será",
    );
  });

  it("mantém controles grandes e responsivos para computador, tablet e celular", () => {
    expect(styles).toContain("min-height: 72px");
    expect(styles).toContain("grid-template-columns: repeat(4");
    expect(styles).toContain("@media (max-width: 900px)");
    expect(styles).toContain("@media (max-width: 620px)");
  });
});
