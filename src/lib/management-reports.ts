import type { SessionSummary } from "./cash-reports";
import {
  cashNumber, channelLabel, dashes, dateOnly, footer, header, methodLabel, money, pair, percent, signedMoney, timeOnly, title, wrap,
} from "./thermal-format";

export type ManagementReport = {
  period: { start: string; end: string; days: number; previous_start: string; previous_end: string };
  kpis: {
    revenue: number; previous_revenue: number; sales_count: number; previous_sales_count: number; slices_sold: number;
    rewards_count: number; losses: number; fees: number; cash_difference: number; deferred_open: number;
  };
  daily: Array<{ date: string; revenue: number; count: number }>;
  hourly: Array<{ hour: number; count: number }>;
  payments: Array<{ method: string; label: string; amount: number; fee: number }>;
  flavors: Array<{ name: string; sold: number; rewards: number | null; revenue: number; unit_cost: number | null; cost: number | null }>;
  channels: Array<{ channel: string; count: number; revenue: number }>;
  sessions: SessionSummary[];
  expenses: Array<{ date: string; kind: string; method: string; amount: number; notes: string }>;
  receivables: Array<{ order_number: string; customer_name: string; remaining: number; created_at: string; days: number }>;
  losses: Array<{ name: string; quantity: number; cost: number | null }>;
  adjustments: { discounts: number; rewards_value: number; cancelled_count: number; cancelled_value: number };
  dre: { table_value: number; discounts: number; rewards_value: number; revenue: number; fees: number; cogs: number; cogs_coverage: number; losses_cost: number; expenses: number };
};

const n = (value: unknown) => Number(value || 0);
export const periodLabel = (report: ManagementReport) =>
  report.period.start === report.period.end ? dateOnly(report.period.start) : `${dateOnly(report.period.start)} a ${dateOnly(report.period.end)}`;

export const dreValues = (report: ManagementReport) => {
  const d = report.dre;
  const revenue = n(d.revenue);
  const net = revenue - n(d.fees);
  const result = net - n(d.cogs) - n(d.losses_cost) - n(d.expenses);
  return { revenue, net, result, cancelled: n(report.adjustments.cancelled_value) };
};

const base = (report: ManagementReport, name: string) => [...header(name.toUpperCase(), periodLabel(report)), dashes()];

export function summaryReceipt(report: ManagementReport) {
  const k = report.kpis;
  const ticket = k.sales_count ? n(k.revenue) / k.sales_count : 0;
  return footer([
    ...base(report, "Resumo de vendas"),
    `#B ${pair("FATURAMENTO", money(k.revenue))[0]}`,
    ...pair("(-) Taxas estimadas", money(k.fees)),
    `#B ${pair("= LÍQUIDO", money(n(k.revenue) - n(k.fees)))[0]}`,
    ...pair("Período anterior", money(k.previous_revenue)),
    dashes(),
    ...pair("Vendas realizadas", k.sales_count),
    ...pair("Ticket médio", money(ticket)),
    ...pair("Fatias vendidas", k.slices_sold),
    ...pair("Cortesias do Clube", k.rewards_count),
    ...pair("Perdas", k.losses),
    ...pair("Diferença de caixa", signedMoney(n(k.cash_difference))),
    ...pair("A receber (fiado)", money(k.deferred_open)),
    dashes(),
    title("Recebimentos"),
    ...report.payments.flatMap((p) => pair(p.label || methodLabel(p.method), money(p.amount))),
  ]);
}

export function paymentsReceipt(report: ManagementReport) {
  const total = report.payments.reduce((sum, p) => sum + n(p.amount), 0);
  return footer([
    ...base(report, "Recebimentos por forma"),
    ...report.payments.flatMap((p) => [
      `#B ${p.label || methodLabel(p.method)}`,
      ...pair(`  Bruto (${percent(n(p.amount), total)})`, money(p.amount)),
      ...pair("  Taxa estimada", money(p.fee)),
      ...pair("  Líquido", money(n(p.amount) - n(p.fee))),
    ]),
    dashes(),
    `#B ${pair("TOTAL", money(total))[0]}`,
    ...pair("Taxas", money(report.payments.reduce((sum, p) => sum + n(p.fee), 0))),
  ]);
}

export function flavorsPeriodReceipt(report: ManagementReport) {
  const rows = report.flavors.map((f) => `${f.name.slice(0, 19).padEnd(19)}${String(f.sold).padStart(4)}${Math.round(n(f.revenue)).toString().padStart(9)}`);
  return footer([
    ...base(report, "Vendas por sabor"),
    `#B ${"SABOR".padEnd(19)} QTD  RECEITA`,
    ...(rows.length ? rows : ["Nenhuma venda no período"]),
    dashes(),
    ...pair("Total de fatias", report.flavors.reduce((sum, f) => sum + n(f.sold), 0)),
    ...pair("Receita", money(report.flavors.reduce((sum, f) => sum + n(f.revenue), 0))),
    ...(report.losses.length ? [dashes(), title("Perdas"), ...report.losses.flatMap((l) => pair(l.name.slice(0, 24), l.quantity))] : []),
  ]);
}

export function dailyReceipt(report: ManagementReport) {
  return footer([
    ...base(report, "Vendas por dia"),
    "#B DIA         VENDAS   FATURAMENTO",
    ...report.daily.map((d) => `${dateOnly(d.date).padEnd(12)}${String(d.count).padStart(6)}${money(d.revenue).padStart(14)}`),
    dashes(),
    ...pair("Total", money(report.daily.reduce((sum, d) => sum + n(d.revenue), 0))),
    dashes(),
    title("Vendas por horário"),
    ...report.hourly.filter((h) => h.count > 0).map((h) => `${String(h.hour).padStart(2, "0")}h ${"#".repeat(Math.min(20, h.count))} ${h.count}`),
  ]);
}

export function channelsReceipt(report: ManagementReport) {
  return footer([
    ...base(report, "Vendas por canal"),
    ...report.channels.flatMap((c) => [`#B ${channelLabel(c.channel)}`, ...pair(`  ${c.count} vendas`, money(c.revenue))]),
  ]);
}

export function sessionsReceipt(report: ManagementReport) {
  return footer([
    ...base(report, "Caixas do período"),
    ...report.sessions.flatMap((s) => [
      `#B CAIXA ${cashNumber(s.number)}`,
      ...wrap(`${dateOnly(s.opened_at)} ${timeOnly(s.opened_at)}-${timeOnly(s.closed_at)} ${s.opened_by_name}`),
      ...pair(`Vendas ${s.sales_count}`, money(s.revenue)),
      ...pair("Diferença", s.status === "closed" ? signedMoney(n(s.drawer.difference)) : "aberto"),
      dashes(),
    ]),
  ]);
}

export function expensesReceipt(report: ManagementReport) {
  const labels: Record<string, string> = { expense: "Despesa", withdrawal: "Sangria", supply: "Suprimento" };
  return footer([
    ...base(report, "Despesas e movimentos"),
    ...(report.expenses.length ? report.expenses.flatMap((e) => [
      `#B ${labels[e.kind] || e.kind} - ${dateOnly(e.date)}`,
      ...wrap(e.notes || "-"),
      ...pair(`  ${methodLabel(e.method)}`, money(e.amount)),
    ]) : ["Nenhum lançamento no período"]),
  ]);
}

export function receivablesReceipt(report: ManagementReport) {
  return footer([
    ...header("A RECEBER (FIADO)", "posição atual"),
    dashes(),
    ...(report.receivables.length ? report.receivables.flatMap((r) => [
      `#B ${r.customer_name}`.slice(0, 35),
      ...pair(`  ${r.order_number} - ${r.days} dia(s)`, money(r.remaining)),
    ]) : ["Nada a receber"]),
    dashes(),
    ...pair("Total", money(report.receivables.reduce((sum, r) => sum + n(r.remaining), 0))),
  ]);
}

export function adjustmentsReceipt(report: ManagementReport) {
  const a = report.adjustments;
  return footer([
    ...base(report, "Descontos e cortesias"),
    ...pair("Descontos concedidos", money(a.discounts)),
    ...pair("Cortesias do Clube", money(a.rewards_value)),
    ...pair(`Cancelamentos (${a.cancelled_count})`, money(a.cancelled_value)),
  ]);
}

export function dreReceipt(report: ManagementReport) {
  const d = report.dre;
  const v = dreValues(report);
  return footer([
    ...base(report, "Resultado (DRE)"),
    ...pair("Vendas preço de tabela", money(d.table_value)),
    ...pair("(-) Descontos", money(d.discounts)),
    ...pair("(-) Cortesias do Clube", money(d.rewards_value)),
    `#B ${pair("= RECEITA DE VENDAS", money(v.revenue))[0]}`,
    ...pair("(-) Taxas Pix/cartões", money(d.fees)),
    `#B ${pair("= RECEITA LÍQUIDA", money(v.net))[0]}`,
    ...pair("(-) Custo das fatias", money(d.cogs)),
    ...pair("(-) Perdas (custo)", money(d.losses_cost)),
    ...pair("(-) Despesas do caixa", money(d.expenses)),
    `#B ${pair("= RESULTADO", signedMoney(v.result))[0]}`,
    dashes(),
    ...wrap(`Custo cadastrado para ${d.cogs_coverage}% das fatias vendidas.`),
  ]);
}

export function comparisonReceipt(report: ManagementReport) {
  const k = report.kpis;
  const delta = (current: number, previous: number) => (previous ? `${(((current - previous) / previous) * 100).toFixed(1).replace(".", ",")}%` : "-");
  return footer([
    ...base(report, "Comparativo"),
    ...wrap(`Anterior: ${dateOnly(report.period.previous_start)} a ${dateOnly(report.period.previous_end)}`),
    dashes(),
    title("Faturamento"),
    ...pair("  Atual", money(k.revenue)),
    ...pair("  Anterior", money(k.previous_revenue)),
    ...pair("  Variação", delta(n(k.revenue), n(k.previous_revenue))),
    title("Vendas"),
    ...pair("  Atual", k.sales_count),
    ...pair("  Anterior", k.previous_sales_count),
    ...pair("  Variação", delta(n(k.sales_count), n(k.previous_sales_count))),
  ]);
}

export type ReportDefinition = { id: string; name: string; description: string; build: (report: ManagementReport) => string[]; tab: string };

export const reportCatalog: ReportDefinition[] = [
  { id: "summary", name: "Resumo de vendas", description: "Faturamento, líquido, ticket médio, fatias e diferenças de caixa.", build: summaryReceipt, tab: "painel" },
  { id: "sessions", name: "Caixas do período", description: "Cada caixa numerado, com vendas e diferença. Reimpressão do fechamento completo em Caixas.", build: sessionsReceipt, tab: "caixas" },
  { id: "flavors", name: "Vendas por sabor", description: "Do mais vendido para o menos vendido, com receita e perdas.", build: flavorsPeriodReceipt, tab: "sabores" },
  { id: "payments", name: "Recebimentos por forma", description: "Dinheiro, Pix, crédito e débito com taxas e líquido.", build: paymentsReceipt, tab: "recebimentos" },
  { id: "daily", name: "Vendas por dia e horário", description: "Faturamento diário e horários de pico.", build: dailyReceipt, tab: "vendas" },
  { id: "channels", name: "Vendas por canal", description: "Balcão, site e WhatsApp.", build: channelsReceipt, tab: "vendas" },
  { id: "expenses", name: "Despesas, sangrias e suprimentos", description: "Tudo o que entrou ou saiu da gaveta fora das vendas.", build: expensesReceipt, tab: "despesas" },
  { id: "receivables", name: "A receber (fiado)", description: "Quem deve, quanto e há quantos dias.", build: receivablesReceipt, tab: "despesas" },
  { id: "adjustments", name: "Descontos, cortesias e cancelamentos", description: "Valores que reduziram a receita.", build: adjustmentsReceipt, tab: "resultado" },
  { id: "dre", name: "Resultado (DRE)", description: "Receita, taxas, custos, despesas e resultado.", build: dreReceipt, tab: "resultado" },
  { id: "comparison", name: "Comparativo de períodos", description: "Período escolhido × período anterior de mesmo tamanho.", build: comparisonReceipt, tab: "painel" },
];

/** CSV com ponto e vírgula (abre direto no Excel em português). */
export function managementCsv(report: ManagementReport) {
  const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const num = (value: unknown) => n(value).toFixed(2).replace(".", ",");
  const rows: string[] = [];
  rows.push(["Seção", "Item", "Quantidade", "Valor", "Taxa"].map(esc).join(";"));
  report.daily.forEach((d) => rows.push([esc("Vendas por dia"), esc(dateOnly(d.date)), d.count, num(d.revenue), ""].join(";")));
  report.payments.forEach((p) => rows.push([esc("Recebimentos"), esc(p.label), "", num(p.amount), num(p.fee)].join(";")));
  report.flavors.forEach((f) => rows.push([esc("Sabores"), esc(f.name), f.sold, num(f.revenue), ""].join(";")));
  report.sessions.forEach((s) => rows.push([esc("Caixas"), esc(`${cashNumber(s.number)} ${dateOnly(s.opened_at)}`), s.sales_count, num(s.revenue), num(s.drawer.difference)].join(";")));
  report.expenses.forEach((e) => rows.push([esc("Movimentos"), esc(`${e.kind} ${e.notes}`), "", num(e.amount), ""].join(";")));
  const v = dreValues(report);
  rows.push([esc("Resultado"), esc("Receita de vendas"), "", num(v.revenue), ""].join(";"));
  rows.push([esc("Resultado"), esc("Receita líquida"), "", num(v.net), ""].join(";"));
  rows.push([esc("Resultado"), esc("Resultado"), "", num(v.result), ""].join(";"));
  return "﻿" + rows.join("\r\n");
}
