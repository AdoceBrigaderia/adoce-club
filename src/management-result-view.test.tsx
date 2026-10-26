import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ManagementOverview from "./ManagementOverview";
import ManagementIncomeStatement from "./ManagementIncomeStatement";
import { calculateManagementResult, classifyCoverage } from "./lib/management-accounting";
import type { ManagementReportV2 } from "./lib/management-reports";

export function resultFixture(): ManagementReportV2 {
  const coverage = classifyCoverage({ historical: { units: 10, revenueCents: 100000 }, estimated_current: { units: 0, revenueCents: 0 }, missing: { units: 0, revenueCents: 0 } });
  const calculated = calculateManagementResult({ salesRevenueCents: 100000, feesCents: 0, cogsCents: 40000, lossesCents: 2000, unabsorbedOperatingExpensesCents: 10000, absorbedFixedCostsCents: 5000, proLaboreCents: 15000, ownerWithdrawalsCents: 7000, coverage });
  const result = { ...calculated, feesEstimatedCents: 0, feesActualCents: 0, lossesCents: 2000, unabsorbedOperatingExpensesCents: 10000, isPartial: false };
  const period = { start: "2026-10-01", end: "2026-10-01", days: 1, previous_start: "2026-09-30", previous_end: "2026-09-30" };
  return {
    schema_version: 2, monetary_unit: "BRL_cents", period, result, coverage,
    cost_classes: { variable_material_packaging: null, variable_fee: 0, direct_labor: null, allocated_fixed: 5000, depreciation: null, unabsorbed_operating_expense: 10000, pro_labore: 15000, unclassifiedCogsCents: 35000, allocationStatus: "unallocated_manual_total" },
    cash: { receivedCents: 80000, expenseCents: 10000, withdrawalCents: 7000, supplyCents: 0, cashDifferenceCents: -100 },
    receivables: { basis: "current_position", totalCents: 20000, items: [] },
    comparison: { period, result: { ...result }, coverage: { ...coverage }, daily: [] }, warnings: [],
    kpis: { revenue: 1000, previous_revenue: 1000, sales_count: 10, previous_sales_count: 10, slices_sold: 10, rewards_count: 0, losses: 1, fees: 0, cash_difference: -1, deferred_open: 200 },
    daily: [{ date: "2026-10-01", revenue: 1000, count: 10 }], hourly: [], payments: [], flavors: [], channels: [], sessions: [], expenses: [], losses: [],
    adjustments: { discounts: 0, rewards_value: 0, cancelled_count: 0, cancelled_value: 0 },
    dre: { table_value: 1000, discounts: 0, rewards_value: 0, revenue: 1000, fees: 0, cogs: 400, cogs_coverage: 100, losses_cost: 20, expenses: 100 },
  };
}
const render = (view: React.ReactNode) => renderToStaticMarkup(view).replace(/&nbsp;|\u00a0/g, " ");

describe("resultado gerencial v2", () => {
  it("deduz pró-labore uma vez e mantém retiradas e custos absorvidos separados", () => {
    const html = render(<ManagementIncomeStatement report={resultFixture()} />);
    expect(html).toMatch(/Resultado antes do pró-labore[\s\S]*?R\$ 480,00/);
    expect(html).toMatch(/Lucro após pró-labore[\s\S]*?R\$ 330,00/);
    expect(html).toMatch(/Retiradas dos sócios[\s\S]*?R\$ 70,00/);
    expect(html).toContain("já incluídos no CMV");
    expect(html).toContain("33,0%");
  });
  it.each(["result", "warning", "coverage"])("avisa resultado parcial antes dos indicadores por %s", (source) => {
    const report = resultFixture();
    if (source === "result") report.result.isPartial = true;
    if (source === "warning") report.warnings = ["pro_labore_not_classified"];
    if (source === "coverage") report.coverage = classifyCoverage({ historical: { units: 8, revenueCents: 80000 }, estimated_current: { units: 0, revenueCents: 0 }, missing: { units: 2, revenueCents: 20000 } });
    for (const Component of [ManagementOverview, ManagementIncomeStatement]) {
      const html = render(<Component report={report} />);
      expect(html).toContain('role="alert"');
      expect(html.indexOf("Resultado parcial")).toBeLessThan(html.indexOf("Receita de vendas"));
      expect(html).not.toContain("confirmado");
    }
  });
  it("identifica estimativas e custos ausentes sem tratar ausente como zero", () => {
    const report = resultFixture();
    report.warnings = ["estimated_current_costs", "missing_costs", "cost_classes_unallocated", "pro_labore_not_classified"];
    report.result.absorbedFixedCostsCents = null;
    report.result.ownerWithdrawalsCents = null;
    const html = render(<ManagementIncomeStatement report={report} />);
    expect(html).toContain("estimado");
    expect(html).toContain("Sem custo");
    expect(html).toContain("Não classificado");
    expect(html).toContain("Pró-labore ainda não classificado");
  });
  it("oferece tabela com os mesmos valores do gráfico e botões para detalhar indicadores", () => {
    const html = render(<ManagementOverview report={resultFixture()} />);
    expect(html).toContain("Vendas por dia");
    expect(html).toContain("<caption>Vendas por dia</caption>");
    expect(html).toContain("<caption>Cobertura de custos</caption>");
    expect(html).toContain("R$ 1.000,00");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Posição atual");
  });
  it("avisa a limitação do comparativo antes de exibir variações", () => {
    const report = resultFixture();
    report.comparison.result.isPartial = true;
    const html = render(<ManagementOverview report={report} />);
    expect(html.indexOf("Comparativo anterior parcial")).toBeLessThan(html.indexOf("vs período anterior"));
  });
  it("mostra período vazio sem fabricar margem", () => {
    const report = resultFixture();
    report.kpis.sales_count = 0;
    report.daily = [];
    report.result = { ...report.result, salesRevenueCents: 0, netRevenueCents: 0, coveredRevenueCents: 0, cogsCents: 0, coveredGrossProfitCents: 0, lossesCents: 0, unabsorbedOperatingExpensesCents: 0, operatingResultBeforeProLaboreCents: 0, proLaboreCents: 0, profitAfterProLaboreCents: 0 };
    report.coverage = classifyCoverage({ historical: { units: 0, revenueCents: 0 }, estimated_current: { units: 0, revenueCents: 0 }, missing: { units: 0, revenueCents: 0 } });
    const html = render(<ManagementOverview report={report} />);
    expect(html).toContain("Sem vendas no período");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });
  it("expõe erro com nova tentativa e carregamento sem números antigos", () => {
    const html = render(<ManagementOverview report={null} error="Não foi possível carregar o resultado." onRetry={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Tentar novamente");
    expect(html).not.toContain("R$");
    expect(render(<ManagementOverview report={null} loading />)).toContain("Carregando o resultado");
  });
});
