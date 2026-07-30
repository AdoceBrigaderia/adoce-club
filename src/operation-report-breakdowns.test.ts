import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  channelLabel,
  normalizeOperationalReportBreakdowns,
} from "./operational-report-breakdowns";

const component = readFileSync(
  new URL("./OperationReportBreakdowns.tsx", import.meta.url),
  "utf8",
);
const reports = readFileSync(
  new URL("./OperationReports.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("./operation-reports.css", import.meta.url),
  "utf8",
);

describe("detalhamentos operacionais dos relatórios", () => {
  it("normaliza os quatro detalhamentos sem transformar valor protegido em zero", () => {
    const result = normalizeOperationalReportBreakdowns({
      orders_by_channel: [{ channel: "online", orders: "3", gross: null, net: null }],
      sales_by_cash_register: [{
        store_id: "store-1",
        store_name: "Passaré",
        register_id: "register-1",
        register_name: "Caixa principal",
        finance_authorized: false,
        orders: 2,
        gross: null,
        net: null,
      }],
      sales_by_operator: [{
        store_id: "store-1",
        store_name: "Passaré",
        operator_user_id: null,
        operator_name: "",
        finance_authorized: true,
        orders: 4,
        gross: "64.5",
      }],
      cash_sessions_by_register: [{
        store_id: "store-1",
        store_name: "Passaré",
        register_id: "register-1",
        register_name: "Caixa principal",
        finance_authorized: false,
        sessions: 1,
        open_sessions: 0,
        closed_sessions: 1,
        divergent_sessions: null,
        absolute_difference: null,
      }],
    });

    expect(result.ordersByChannel[0]).toMatchObject({ orders: 3, gross: null, net: null });
    expect(result.salesByCashRegister[0].gross).toBeNull();
    expect(result.salesByOperator[0]).toMatchObject({ operator_name: "Operador sem nome", gross: 64.5 });
    expect(result.cashSessionsByRegister[0].divergent_sessions).toBeNull();
  });

  it("mantém rótulos operacionais claros para canais conhecidos e desconhecidos", () => {
    expect(channelLabel("online")).toBe("On-line");
    expect(channelLabel("presencial")).toBe("Presencial");
    expect(channelLabel("parceiro")).toBe("parceiro");
    expect(channelLabel("")).toBe("Canal não informado");
  });

  it("conecta os quatro detalhamentos ao painel sem nova chamada direta", () => {
    expect(reports).toContain('import OperationReportBreakdowns from "./OperationReportBreakdowns"');
    expect(reports).toContain("OperationalReportBreakdownPayload");
    expect(reports).toContain("<OperationReportBreakdowns report={report} />");
    expect(component).toContain("ordersByChannel");
    expect(component).toContain("salesByCashRegister");
    expect(component).toContain("salesByOperator");
    expect(component).toContain("cashSessionsByRegister");
    expect(component).not.toContain("bffRpc(");
    expect(component).not.toContain("requireSupabase");
  });

  it("mantém leitura imediata com zero toque adicional", () => {
    expect(component).toContain('data-touch-budget="0"');
    expect(component).not.toContain("<details");
    expect(component).not.toContain("<dialog");
    expect(component).not.toContain("onClick=");
    expect(styles).toContain(".operation-report-breakdowns-grid");
    expect(styles).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
    expect(styles).toContain(".operation-report-breakdown-card .operation-reports-table article{min-height:64px}");
    expect(styles).toContain("@media(max-width:820px)");
    expect(styles).toContain(".operation-report-breakdowns-grid{grid-template-columns:1fr}");
  });

  it("expõe proteção financeira por linha em todas as superfícies sensíveis", () => {
    expect(component).toContain('value === null ? "Protegido por permissão"');
    expect(component.match(/Financeiro protegido/g)?.length).toBeGreaterThanOrEqual(3);
    expect(component).toContain("Divergências protegidas");
    expect(component).not.toContain('money(row.gross || 0)');
  });
});
