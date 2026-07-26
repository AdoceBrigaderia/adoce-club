import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPERATION_RPC_ALLOWLIST } from "../netlify/functions/_shared/bff-rpc-policy";

const source = readFileSync(new URL("./OperationReports.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./operation-reports.css", import.meta.url), "utf8");
const hub = readFileSync(new URL("./OperationBusinessHub.tsx", import.meta.url), "utf8");

describe("painel operacional de relatórios", () => {
  it("usa o consolidado somente pelo BFF", () => {
    expect(OPERATION_RPC_ALLOWLIST).toContain("staff_get_operational_reports");
    expect(source).toContain('bffRpc<ReportsData>("staff_get_operational_reports"');
    expect(source).not.toContain("requireSupabase");
    expect(source).not.toContain("Authorization");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
  });

  it("oferece períodos rápidos e filtro por loja", () => {
    expect(source).toContain("Hoje");
    expect(source).toContain("7 dias");
    expect(source).toContain("30 dias");
    expect(source).toContain("90 dias");
    expect(source).toContain("Todas acessíveis");
  });

  it("mostra vendas, clientes, fidelidade, produtos e caixa", () => {
    expect(source).toContain("Vendas brutas");
    expect(source).toContain("Novos clientes");
    expect(source).toContain("Carimbos adicionados");
    expect(source).toContain("Produtos mais vendidos");
    expect(source).toContain("Diferença absoluta de caixa");
  });

  it("fica integrado e responsivo", () => {
    expect(hub).toContain('import OperationReports from "./OperationReports"');
    expect(hub).toContain("<OperationReports />");
    expect(styles).toContain("@media(max-width:820px)");
    expect(styles).toContain("@media(max-width:520px)");
    expect(styles).toContain("min-height:58px");
  });
});
