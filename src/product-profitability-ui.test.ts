import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  new URL("./OperationProductProfitability.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("./operation-product-profitability.css", import.meta.url),
  "utf8",
);
const hub = readFileSync(
  new URL("./OperationBusinessHub.tsx", import.meta.url),
  "utf8",
);
const adminCenter = readFileSync(
  new URL("./OperationAdminCenter.tsx", import.meta.url),
  "utf8",
);

describe("painel de rentabilidade dos produtos", () => {
  it("mostra custo, preço, lucro, margem, markup e rendimento", () => {
    for (const label of [
      "Custo total",
      "Preço usado",
      "Lucro bruto",
      "Margem",
      "Markup",
      "Custo por",
    ]) {
      expect(component).toContain(label);
    }
  });

  it("permite custo provisório ou ficha técnica calculada", () => {
    expect(component).toContain("manual_provisional");
    expect(component).toContain("recipe_snapshot");
    expect(component).toContain("Ficha técnica calculada");
    expect(component).toContain("latest_snapshot_cost");
    expect(component).toContain("latest_snapshot_id");
  });

  it("usa apenas RPCs internas do BFF", () => {
    expect(component).toContain(
      'bffRpc<Workspace>("manager_get_product_profitability_workspace"',
    );
    expect(component).toContain(
      'bffRpc<Workspace>("manager_save_product_costing_settings"',
    );
    expect(component).not.toContain("requireSupabase");
    expect(component).not.toContain("localStorage");
    expect(component).not.toContain("sessionStorage");
  });

  it("mantém custos restritos a owner e manager na central administrativa", () => {
    expect(hub).toContain('const canConfigureProduction = ["owner", "manager"]');
    expect(hub).toContain("<OperationAdminCenter userId={session.user.id} />");
    expect(adminCenter).toContain(
      'import OperationProductProfitability from "./OperationProductProfitability"',
    );
    expect(adminCenter).toContain(
      'activeArea === "profitability" ? <OperationProductProfitability /> : null',
    );
  });

  it("prioriza botões grandes e adaptação para celular e tablet", () => {
    expect(styles).toContain("min-height: 3.25rem");
    expect(styles).toContain("@media (max-width: 980px)");
    expect(styles).toContain("@media (max-width: 620px)");
    expect(styles).toContain("grid-template-columns: 1fr");
  });
});
