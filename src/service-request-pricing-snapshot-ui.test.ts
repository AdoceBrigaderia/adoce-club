import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  new URL("./OperationServiceRequestPricingSnapshot.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("./operation-service-request-pricing-snapshot.css", import.meta.url),
  "utf8",
);
const hub = readFileSync(new URL("./OperationBusinessHub.tsx", import.meta.url), "utf8");
const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("consulta operacional do snapshot financeiro", () => {
  it("usa somente o BFF e exige identificador completo da encomenda", () => {
    expect(component).toContain('bffRpc<PricingSnapshot | null>');
    expect(component).toContain('"manager_get_service_request_pricing_snapshot"');
    expect(component).toContain("UUID.test(normalized)");
    expect(component).not.toContain("requireSupabase");
    expect(component).not.toContain(".from(");
    expect(policy).toContain('"manager_get_service_request_pricing_snapshot"');
  });

  it("mostra custo, preço, lucro, margem, markup e mínimo histórico", () => {
    for (const field of [
      "snapshot.unit_cost",
      "snapshot.unit_price",
      "snapshot.total_cost",
      "snapshot.total_price",
      "snapshot.gross_profit",
      "snapshot.margin",
      "snapshot.markup",
      "snapshot.minimum_margin",
    ]) {
      expect(component).toContain(field);
    }
    expect(component).toContain("Margem abaixo do mínimo");
    expect(component).toContain("Margem protegida");
  });

  it("apresenta a composição congelada do Adoce do Seu Jeito", () => {
    expect(component).toContain("cake_builder_summary");
    expect(component).toContain("Composição registrada");
    expect(component).toContain("Camadas de bolo");
    expect(component).toContain("Adicionais na cobertura");
  });

  it("fica restrito a owner e manager na central da operação", () => {
    expect(hub).toContain(
      'import OperationServiceRequestPricingSnapshot from "./OperationServiceRequestPricingSnapshot"',
    );
    expect(hub).toContain(
      "canConfigureProduction ? <OperationServiceRequestPricingSnapshot /> : null",
    );
    expect(hub).toContain('["owner", "manager"].includes(session.user.role)');
  });

  it("mantém botões grandes e layout responsivo", () => {
    expect(css).toContain("min-height: 3.25rem");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(css).toContain("@media (min-width: 720px)");
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
  });
});
