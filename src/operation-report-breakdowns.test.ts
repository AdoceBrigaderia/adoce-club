import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  channelLabel,
  normalizeOperationalReportBreakdowns,
  normalizeOperationalReportFilterOptions,
  normalizeOperationalReportFilters,
  normalizeOperationalReportPeriod,
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
  new URL("./operation-report-breakdown-filters.css", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../supabase/migrations/20260729230000_filter_operational_report_breakdowns.sql", import.meta.url),
  "utf8",
);

describe("detalhamentos operacionais dos relatórios", () => {
  it("normaliza detalhamentos e filtros sem transformar valor protegido em zero", () => {
    const payload = {
      period: { from: "2026-07-23", to: "2026-07-29", store_id: "store-1" },
      active_filters: {
        channel: "presencial",
        operator_user_id: "operator-1",
        register_id: "register-1",
      },
      filter_options: {
        channels: [{ value: "presencial" }],
        operators: [{ value: "operator-1", label: "Beth", store_id: "store-1", store_name: "Passaré" }],
        registers: [{ value: "register-1", label: "Caixa principal", store_id: "store-1", store_name: "Passaré" }],
      },
      orders_by_channel: [{ channel: "presencial", orders: "3", gross: null, net: null }],
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
        operator_user_id: "operator-1",
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
    };

    const result = normalizeOperationalReportBreakdowns(payload);
    expect(result.ordersByChannel[0]).toMatchObject({ orders: 3, gross: null, net: null });
    expect(result.salesByCashRegister[0].gross).toBeNull();
    expect(result.salesByOperator[0]).toMatchObject({ operator_name: "Operador sem nome", gross: 64.5 });
    expect(result.cashSessionsByRegister[0].divergent_sessions).toBeNull();
    expect(normalizeOperationalReportPeriod(payload)).toEqual({
      from: "2026-07-23",
      to: "2026-07-29",
      storeId: "store-1",
    });
    expect(normalizeOperationalReportFilters(payload)).toEqual({
      channel: "presencial",
      operatorUserId: "operator-1",
      registerId: "register-1",
    });
    expect(normalizeOperationalReportFilterOptions(payload).operators[0]).toMatchObject({
      value: "operator-1",
      label: "Beth",
      storeName: "Passaré",
    });
  });

  it("mantém rótulos operacionais claros para canais conhecidos e desconhecidos", () => {
    expect(channelLabel("online")).toBe("On-line");
    expect(channelLabel("presencial")).toBe("Presencial");
    expect(channelLabel("parceiro")).toBe("parceiro");
    expect(channelLabel("")).toBe("Canal não informado");
  });

  it("aplica filtros somente pelo BFF e preserva escopo por loja no backend", () => {
    expect(reports).toContain('import OperationReportBreakdowns from "./OperationReportBreakdowns"');
    expect(reports).toContain("<OperationReportBreakdowns report={report} />");
    expect(component).toContain('bffRpc<OperationalReportBreakdownPayload>');
    expect(component).toContain('"staff_get_operational_reports"');
    expect(component).toContain("target_store_id: period.storeId");
    expect(component).toContain("target_channel: nextFilters.channel");
    expect(component).toContain("target_operator_user_id: nextFilters.operatorUserId");
    expect(component).toContain("target_register_id: nextFilters.registerId");
    expect(component).not.toContain("requireSupabase");
    expect(component).not.toContain("localStorage");
    expect(migration).toContain("join report_stores store on store.id = customer_order.store_id");
    expect(migration).toContain("join report_stores store on store.id = movement.store_id");
    expect(migration).toContain("private.staff_has_capability(store.id, 'view_reports')");
  });

  it("troca qualquer recorte com um toque em alvos grandes", () => {
    expect(component).toContain('data-touch-budget="1"');
    expect(component).toContain('aria-pressed={activeValue === option.value}');
    expect(component).toContain('onClick={() => onChange(option.value)}');
    expect(component).not.toContain("<details");
    expect(component).not.toContain("<dialog");
    expect(styles).toContain("min-height:48px");
    expect(styles).toContain("touch-action:manipulation");
    expect(styles).toContain("@media(max-width:820px)");
    expect(styles).toContain("min-height:52px");
    expect(styles).toContain("min-height:56px");
  });

  it("mantém a redação financeira em todos os recortes", () => {
    expect(component).toContain('value === null ? "Protegido por permissão"');
    expect(component.match(/Financeiro protegido/g)?.length).toBeGreaterThanOrEqual(3);
    expect(component).toContain("Divergências protegidas");
    expect(component).not.toContain("money(row.gross || 0)");
    expect(migration).toContain("case when (select finance_scope_complete from scope_flags)");
    expect(migration).toContain("case when store.finance_authorized");
    expect(migration).toContain("else null");
  });
});
