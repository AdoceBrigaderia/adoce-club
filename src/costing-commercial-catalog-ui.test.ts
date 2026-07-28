import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  new URL("./OperationCostCatalog.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("./operation-cost-catalog.css", import.meta.url),
  "utf8",
);
const hub = readFileSync(
  new URL("./OperationBusinessHub.tsx", import.meta.url),
  "utf8",
);

describe("painel rápido de custos e margens", () => {
  it("mostra custo, preço, lucro, margem e markup sem cálculo manual", () => {
    for (const label of [
      "Custo efetivo",
      "Preço de venda",
      "Lucro bruto",
      "Margem",
      "Markup",
    ]) {
      expect(component).toContain(label);
    }
    expect(component).toContain("manager_get_costing_catalog_workspace");
    expect(component).toContain("manager_save_costing_catalog_item");
  });

  it("permite as cinco origens de custo definidas pela operação", () => {
    for (const label of [
      "Fabricação própria",
      "Produto comprado",
      "Item do acervo",
      "Serviço/recurso",
      "Custo manual provisório",
    ]) {
      expect(component).toContain(label);
    }
  });

  it("registra histórico de compra e custo útil", () => {
    expect(component).toContain("Registrar novo preço");
    expect(component).toContain("Quantidade útil");
    expect(component).toContain("manager_add_costing_item_price");
    expect(component).toContain("Preço de compra registrado no histórico");
  });

  it("isola o painel para owner e manager", () => {
    expect(hub).toContain('const canConfigureProduction = ["owner", "manager"]');
    expect(hub).toContain("canConfigureProduction ? <OperationCostCatalog /> : null");
  });

  it("preserva botões grandes e layout mobile/tablet", () => {
    expect(css).toContain("min-height: 2.9rem");
    expect(css).toContain("@media (min-width: 760px)");
    expect(css).toContain("@media (min-width: 1100px)");
    expect(css).toContain("@media (max-width: 560px)");
  });

  it("não expõe identificadores ou comandos de produção", () => {
    expect(component).not.toContain("uefwywizqhfvvijaopcn");
    expect(component).not.toContain("adocebrigaderia.com.br");
    expect(component).not.toContain("--prod");
  });
});
