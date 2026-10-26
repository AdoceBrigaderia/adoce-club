import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ManagementOverview from "./ManagementOverview";
import ManagementIncomeStatement from "./ManagementIncomeStatement";
import { calculateManagementResult, classifyCoverage } from "./lib/management-accounting";
import type { ManagementReportV2 } from "./lib/management-reports";
import { createServer } from "vite";
import { pathToFileURL } from "node:url";

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
  it("inclui componentes numéricos no conteúdo expansível do lucro", () => {
    const html = render(<ManagementIncomeStatement report={resultFixture()} />);
    const detail = html.match(/<details><summary>\(=\) Lucro após pró-labore<\/summary>[\s\S]*?<\/details>/)?.[0];
    expect(detail).toContain("Resultado antes do pró-labore</dt><dd>R$ 480,00");
    expect(detail).toContain("Pró-labore deduzido</dt><dd>− R$ 150,00");
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

// Optional browser dependency is supplied by the desktop runtime, not added to the product.
// Run with ADOCE_MANAGEMENT_PLAYWRIGHT pointing to playwright/index.mjs.
describe.runIf(Boolean(process.env.ADOCE_MANAGEMENT_PLAYWRIGHT))("integração da gestão no navegador", () => {
  it("expande a composição e trata respostas incompletas sem quebrar a tela", async () => {
    const { chromium } = await import(/* @vite-ignore */ pathToFileURL(process.env.ADOCE_MANAGEMENT_PLAYWRIGHT!).href);
    let payload: unknown = resultFixture();
    const rpcCalls: string[] = [];
    const server = await createServer({
      configFile: false, envDir: false, server: { host: "127.0.0.1", port: 0 },
      plugins: [{
        name: "management-test-fixture",
        resolveId(id) { if (id === "/__management_test.tsx") return `${process.cwd()}/__management_test.tsx`; },
        load(id) {
          const normalized = id.replaceAll("\\", "/");
          if (normalized.endsWith("/__management_test.tsx")) return `import React from 'react'; import {createRoot} from 'react-dom/client'; import OperationManagement from '/src/OperationManagement.tsx'; createRoot(document.getElementById('root')).render(<OperationManagement/>);`;
          if (normalized.endsWith("/src/lib/supabase.ts")) return `export const requireSupabase=()=>({rpc:async(name)=>({data:await(await fetch('/__management_rpc?name='+name)).json(),error:null})});`;
          if (normalized.endsWith("/src/OperationArchive.tsx")) return "export default function Archive(){return null}";
          if (normalized.endsWith("/src/lib/print-queue.ts")) return "export const queuePrint=async()=>{}; export const queuePrints=async()=>{};";
        },
        configureServer(vite) {
          vite.middlewares.use((req, res, next) => {
            if (req.url?.startsWith("/__management_rpc")) {
              rpcCalls.push(new URL(req.url, "http://localhost").searchParams.get("name")!);
              res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(payload));
            } else if (req.url === "/__management_test") {
              res.setHeader("Content-Type", "text/html"); res.end('<div id="root"></div><script type="module" src="/__management_test.tsx"></script>');
            } else next();
          });
        },
      }],
    });
    await server.listen();
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error: Error) => errors.push(error.message));
      const address = server.httpServer!.address();
      if (!address || typeof address === "string") throw new Error("Local server unavailable");
      await page.goto(`http://127.0.0.1:${address.port}/__management_test`);
      await page.getByRole("button", { name: /Lucro após pró-labore/ }).click();
      const detail = page.getByRole("region", { name: "Detalhamento do indicador" });
      const text = (await detail.innerText()).replaceAll("\u00a0", " ");
      expect(text).toContain("R$ 480,00");
      expect(text).toContain("− R$ 150,00");
      expect(text).toContain("R$ 330,00");
      await page.getByRole("button", { name: "Resultado (DRE)", exact: true }).click();
      const profit = page.locator("details").filter({ has: page.locator("summary", { hasText: "Lucro após pró-labore" }) });
      await profit.locator("summary").click();
      expect(await profit.getAttribute("open")).not.toBeNull();
      expect((await profit.innerText()).replaceAll("\u00a0", " ")).toContain("− R$ 150,00");
      await page.getByRole("button", { name: "Painel", exact: true }).click();

      // Each missing block must be rejected in the loader before any tab renders it.
      for (const path of ["comparison.coverage", "comparison.result", "period", "kpis", "daily", "hourly", "payments", "flavors", "channels", "sessions", "expenses", "losses", "adjustments", "dre", "cost_classes", "cash", "receivables.items"]) {
        const incomplete = JSON.parse(JSON.stringify(resultFixture()));
        const keys = path.split(".");
        const parent = keys.slice(0, -1).reduce((object, key) => object[key], incomplete);
        delete parent[keys.at(-1)!];
        payload = incomplete;
        await page.getByRole("button", { name: "Atualizar", exact: true }).click();
        await page.getByRole("button", { name: "Tentar novamente", exact: true }).waitFor({ timeout: 1500 });
        expect(await page.getByRole("alert").innerText()).toContain("Não foi possível carregar");
        expect(await page.getByRole("button", { name: /Lucro após pró-labore/ }).count()).toBe(0);
        payload = resultFixture();
        await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        await page.getByRole("button", { name: /Lucro após pró-labore/ }).waitFor();
      }
      expect(errors).toEqual([]);
      expect(rpcCalls.every(name => name === "manager_management_report_v2")).toBe(true);
    } finally {
      await browser.close();
      await server.close();
    }
  }, 60000);
});
