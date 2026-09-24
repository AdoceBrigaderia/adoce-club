import { describe, expect, it } from "vitest";
import { closingPrintJobs, closingReceipt, dayReceipt, flavorsReceipt, openingReceipt, type FullClosingReport, type SessionSummary } from "./lib/cash-reports";
import { managementCsv, reportCatalog, type ManagementReport } from "./lib/management-reports";
import { pair, WIDTH } from "./lib/thermal-format";

const printable = (lines: string[]) => lines.map((line) => line.replace(/^#[HB] /, ""));
const fits = (lines: string[]) => printable(lines).filter((line) => line.length > WIDTH);

const session = (number: number, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: `s${number}`, number, status: "closed", opened_at: "2026-09-24T11:02:00Z", closed_at: "2026-09-24T17:00:00Z",
  opened_by_name: "Beth", closed_by_name: "Beth", sales_count: 20, table_value: 600, discounts: 12, rewards_count: 2, rewards_value: 32,
  revenue: 556, cancelled_count: 1, cancelled_value: 16, slices_sold: 32,
  payments: [{ method: "cash", amount: 120, fee: 0 }, { method: "pix", amount: 266, fee: 1.3 }, { method: "credit_card", amount: 100, fee: 3.89 }, { method: "debit_card", amount: 70, fee: 1.17 }],
  received: 556, fees: 6.36,
  drawer: { opening_float: 150, cash_sales: 120, supplies: 0, withdrawals: 0, cash_expenses: 0, expected: 270, counted: 268, difference: -2 },
  channels: [{ channel: "operation", count: 18 }, { channel: "site", count: 2 }], deferred_count: 1, deferred_value: 38, pix_change: 12, losses: 1,
  ...overrides,
});

const report: FullClosingReport = {
  number: 2, service_date: "2026-09-24", store_name: "Adoce Centro", register_name: "Caixa principal",
  summary: session(2), stock_initial_known: true,
  stock: [
    { name: "Chocolatudo Trufado", short_name: "Chocolatudo Truf", price: 19, initial: 9, sold: 8, rewards: 0, losses: 0, remaining: 1 },
    { name: "Meio Amargo (Massa Amanteigada)", short_name: "Meio Amargo", price: 16, initial: 8, sold: 2, rewards: 1, losses: 1, remaining: 5 },
  ],
  day: { date: "2026-09-24", sessions: [session(1), session(2)] },
};

describe("cupons térmicos do caixa", () => {
  it("nenhuma linha passa das 32 colunas", () => {
    for (const job of closingPrintJobs(report)) expect(fits(job.lines)).toEqual([]);
    expect(fits(openingReceipt({ number: 3, session: { opened_at: "2026-09-24T11:00:00Z", opening_float: 150 }, stock: [{ name: "A", short_name: "A", price: 16, quantity: 10 }] }))).toEqual([]);
  });

  it("fechamento traz número do caixa, blocos com título e a conta da gaveta", () => {
    const text = printable(closingReceipt(report)).join("\n");
    expect(text).toContain("CAIXA Nº 0002");
    for (const section of ["1. RESUMO DAS VENDAS", "2. RECEBIMENTOS POR FORMA", "3. FATIAS (TOTAIS)", "4. GAVETA (DINHEIRO)", "5. OUTROS", "6. CANAIS"]) expect(text).toContain(section);
    expect(text).toContain("DIFERENÇA (FALTA)");
    expect(text).toContain("-R$ 2,00");
  });

  it("relatório de sabores vem do mais vendido para o menos vendido", () => {
    const rows = printable(flavorsReceipt(report));
    const first = rows.findIndex((line) => line.startsWith("Chocolatudo Truf"));
    const second = rows.findIndex((line) => line.startsWith("Meio Amargo"));
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(second);
  });

  it("consolidado do dia só sai com dois ou mais caixas e soma os totais", () => {
    expect(dayReceipt({ ...report, day: { date: "2026-09-24", sessions: [session(1)] } })).toEqual([]);
    const text = printable(dayReceipt(report)).join("\n");
    expect(text).toContain("CONSOLIDADO DO DIA");
    expect(text).toContain("RECEITA DO DIA");
    expect(text).toContain("R$ 1.112,00");
    expect(closingPrintJobs(report)).toHaveLength(3);
  });

  it("marca o fechamento automático", () => {
    expect(printable(closingReceipt({ ...report, auto_closed: true })).join("\n")).toContain("FECHAMENTO AUTOMATICO");
  });

  it("pair alinha valor à direita em 32 colunas", () => {
    expect(pair("Dinheiro", "R$ 10,00")[0]).toHaveLength(WIDTH);
  });
});

const management: ManagementReport = {
  period: { start: "2026-09-01", end: "2026-09-24", days: 24, previous_start: "2026-08-08", previous_end: "2026-08-31" },
  kpis: { revenue: 3280, previous_revenue: 3000, sales_count: 80, previous_sales_count: 70, slices_sold: 140, rewards_count: 3, losses: 2, fees: 34.79, cash_difference: -2, deferred_open: 38 },
  daily: [{ date: "2026-09-24", revenue: 1437, count: 52 }],
  hourly: [{ hour: 15, count: 7 }],
  payments: [{ method: "pix", label: "Pix", amount: 2252, fee: 11.03 }],
  flavors: [{ name: "Trufado de Ninho com Morango (massa de chocolate)", sold: 27, rewards: null, revenue: 432, unit_cost: null, cost: null }],
  channels: [{ channel: "operation", count: 60, revenue: 2400 }],
  sessions: [session(1)],
  expenses: [{ date: "2026-09-24T15:00:00Z", kind: "withdrawal", method: "cash", amount: 100, notes: "Levado ao cofre" }],
  receivables: [{ order_number: "FAT-1", customer_name: "Maria Gabriela Brito de Sousa", remaining: 38, created_at: "2026-09-20T12:00:00Z", days: 4 }],
  losses: [{ name: "Galak", quantity: 1, cost: null }],
  adjustments: { discounts: 12, rewards_value: 48, cancelled_count: 1, cancelled_value: 16 },
  dre: { table_value: 3340, discounts: 12, rewards_value: 48, revenue: 3280, fees: 34.79, cogs: 0, cogs_coverage: 0, losses_cost: 0, expenses: 25 },
};

describe("relatórios da aba Gestão", () => {
  it("todos os relatórios cabem na impressora", () => {
    for (const item of reportCatalog) expect({ id: item.id, over: fits(item.build(management)) }).toEqual({ id: item.id, over: [] });
  });

  it("CSV usa ponto e vírgula e vírgula decimal", () => {
    const csv = managementCsv(management);
    expect(csv).toContain('"Recebimentos";"Pix";;2252,00;11,03');
    expect(csv.startsWith("﻿")).toBe(true);
  });
});

describe("aba Gestão na navegação", () => {
  it("aparece só para proprietário e gerente e tem rota própria", async () => {
    const { readFileSync } = await import("node:fs");
    const access = readFileSync("src/AccessApp.tsx", "utf8");
    expect(access).toContain('{ view: "management" as const, label: "Gestão"');
    expect(access).toContain('if (path.includes("/operacao/gestao")) return "management";');
    expect(access).toContain('{view === "management" && (role === "owner" || role === "manager") && (');
  });
});
