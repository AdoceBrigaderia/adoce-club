import {
  cashNumber, center, channelLabel, dashes, dateOnly, dateTime, doubleLine, footer, header,
  methodLabel, money, pair, percent, signedMoney, timeOnly, title, wrap,
} from "./thermal-format";

export type SessionSummary = {
  id: string;
  number: number;
  status: string;
  opened_at: string;
  closed_at: string | null;
  opened_by_name: string;
  closed_by_name: string | null;
  sales_count: number;
  table_value: number;
  discounts: number;
  rewards_count: number;
  rewards_value: number;
  revenue: number;
  cancelled_count: number;
  cancelled_value: number;
  slices_sold: number;
  payments: Array<{ method: string; amount: number; fee: number }>;
  received: number;
  fees: number;
  drawer: { opening_float: number; cash_sales: number; supplies: number; withdrawals: number; cash_expenses: number; expected: number; counted: number | null; difference: number | null };
  channels: Array<{ channel: string; count: number }>;
  deferred_count: number;
  deferred_value: number;
  pix_change: number;
  losses: number;
};

export type StockRow = { name: string; short_name: string; price: number; initial: number; sold: number; rewards: number; losses: number; remaining: number };

export type FullClosingReport = {
  number?: number;
  service_date?: string;
  store_name?: string;
  register_name?: string;
  summary?: SessionSummary;
  stock?: StockRow[];
  stock_initial_known?: boolean;
  day?: { date: string; sessions: SessionSummary[] } | null;
  auto_closed?: boolean;
};

export type OpeningReport = {
  number?: number;
  session: { opened_at: string; opening_float: number };
  store_name?: string;
  register_name?: string;
  opened_by_name?: string;
  stock?: Array<{ name: string; short_name: string; price: number; quantity: number }>;
};

const n = (value: unknown) => Number(value || 0);
const PAYMENT_ORDER = ["cash", "pix", "credit_card", "debit_card"];

function paymentLines(payments: SessionSummary["payments"]) {
  const lines: string[] = [];
  for (const code of PAYMENT_ORDER) {
    const amount = payments.filter((p) => p.method === code).reduce((sum, p) => sum + n(p.amount), 0);
    lines.push(...pair(methodLabel(code), money(amount)));
  }
  for (const other of payments.filter((p) => !PAYMENT_ORDER.includes(p.method) && p.method !== "payroll")) lines.push(...pair(methodLabel(other.method), money(other.amount)));
  return lines;
}

export function openingReceipt(report: OpeningReport): string[] {
  const stock = report.stock || [];
  const units = stock.reduce((sum, row) => sum + n(row.quantity), 0);
  const potential = stock.reduce((sum, row) => sum + n(row.quantity) * n(row.price), 0);
  return footer([
    ...header("ABERTURA DE CAIXA", `CAIXA ${cashNumber(report.number)}`),
    ...wrap(`Loja: ${report.store_name || "Adoce"}`),
    ...wrap(`Caixa: ${report.register_name || "Principal"}`),
    ...wrap(`Aberto por: ${report.opened_by_name || "Equipe Adoce"}`),
    `Abertura: ${dateTime(report.session.opened_at)}`,
    dashes(),
    title("Dinheiro inicial na gaveta"),
    `#H ${money(report.session.opening_float)}`,
    dashes(),
    title("Fatias no início"),
    ...pair("Fatias disponíveis", units),
    ...pair("Valor se vender tudo", money(potential)),
    dashes(),
    "Confira o dinheiro antes da",
    "primeira venda.",
    "",
    "Assinatura:",
    "",
    "________________________________",
  ]);
}

export function closingReceipt(report: FullClosingReport): string[] {
  const s = report.summary;
  if (!s) return footer([...header("FECHAMENTO DE CAIXA"), "Relatório indisponível."]);
  const d = s.drawer;
  const stock = report.stock || [];
  const initial = stock.reduce((sum, row) => sum + n(row.initial), 0);
  const remaining = stock.reduce((sum, row) => sum + n(row.remaining), 0);
  const potential = stock.reduce((sum, row) => sum + n(row.initial) * n(row.price), 0);
  const difference = n(d.difference);
  const ticket = s.sales_count ? n(s.revenue) / s.sales_count : 0;
  // Desconto em folha é venda, mas o dinheiro não entra: fica fora do total recebido.
  const payroll = s.payments.filter((p) => p.method === "payroll").reduce((sum, p) => sum + n(p.amount), 0);
  return footer([
    ...header("FECHAMENTO DE CAIXA", `CAIXA ${cashNumber(s.number)}`),
    ...(report.auto_closed ? ["#B " + center("FECHAMENTO AUTOMATICO"), ...wrap("Dinheiro contado registrado igual ao esperado.")] : []),
    ...wrap(`Loja: ${report.store_name || "Adoce"}`),
    ...wrap(`Caixa: ${report.register_name || "Principal"}`),
    ...wrap(`Aberto: ${dateTime(s.opened_at)} ${s.opened_by_name}`),
    ...wrap(`Fechado: ${dateTime(s.closed_at)} ${s.closed_by_name || ""}`),
    dashes(),
    title("1. Resumo das vendas"),
    ...pair("Vendas realizadas", s.sales_count),
    ...pair("Ticket médio", money(ticket)),
    ...pair("Vendas (preço tabela)", money(s.table_value)),
    ...pair("(-) Descontos", money(s.discounts)),
    ...pair(`(-) Cortesias Clube (${n(s.rewards_count)})`, money(s.rewards_value)),
    `#B ${pair("= RECEITA DO CAIXA", money(s.revenue))[0]}`,
    ...pair(`Cancelamentos: ${n(s.cancelled_count)}`, money(s.cancelled_value)),
    dashes(),
    title("2. Recebimentos por forma"),
    ...paymentLines(s.payments),
    `#B ${pair("TOTAL RECEBIDO", money(n(s.received) - payroll))[0]}`,
    ...pair("(-) Taxas estimadas", money(s.fees)),
    `#B ${pair("= LÍQUIDO", money(n(s.received) - payroll - n(s.fees)))[0]}`,
    dashes(),
    title("3. Fatias (totais)"),
    ...(report.stock_initial_known ? pair("No início do caixa", initial) : wrap("Início: caixa aberto antes do registro de estoque.")),
    ...pair("Vendidas", n(s.slices_sold)),
    ...(n(s.rewards_count) ? [`  (inclui ${n(s.rewards_count)} cortesias Clube)`] : []),
    ...pair("Perdas/descarte", n(s.losses)),
    ...pair("Sobra ao fechar", remaining),
    ...(report.stock_initial_known ? [...pair("Valor se vendesse tudo", money(potential)), ...pair("Aproveitamento", percent(n(s.slices_sold), initial))] : []),
    "(detalhe por sabor: cupom 2)",
    dashes(),
    title("4. Gaveta (dinheiro)"),
    ...pair("Fundo de abertura", money(d.opening_float)),
    ...pair("(+) Vendas em dinheiro", money(d.cash_sales)),
    ...pair("(+) Suprimentos", money(d.supplies)),
    ...pair("(-) Sangrias", money(d.withdrawals)),
    ...pair("(-) Despesas em dinheiro", money(d.cash_expenses)),
    `#B ${pair("= ESPERADO NA GAVETA", money(d.expected))[0]}`,
    ...pair("Contado", d.counted == null ? "-" : money(d.counted)),
    `#B ${pair(`DIFERENÇA ${difference < 0 ? "(FALTA)" : difference > 0 ? "(SOBRA)" : ""}`.trim(), signedMoney(difference))[0]}`,
    dashes(),
    title("5. Outros"),
    ...pair("Troco devolvido por Pix", money(s.pix_change)),
    " (não sai da gaveta)",
    ...pair(`A receber (fiado): ${n(s.deferred_count)}`, money(s.deferred_value)),
    ...(payroll ? [...pair("A descontar em folha", money(payroll)), " (não entra no caixa)"] : []),
    dashes(),
    title("6. Canais"),
    ...(s.channels.length ? s.channels.flatMap((c) => pair(channelLabel(c.channel), c.count)) : ["Nenhuma venda"]),
    dashes(),
    "Conferido por:",
    "",
    "________________________________",
  ]);
}

export function flavorsReceipt(report: FullClosingReport): string[] {
  const s = report.summary;
  const stock = [...(report.stock || [])].sort((a, b) => n(b.sold) - n(a.sold) || a.name.localeCompare(b.name, "pt-BR"));
  const col = (value: number, width: number) => String(value).padStart(width);
  const rows = stock.map((row) => {
    const name = (row.short_name || row.name).slice(0, 16).padEnd(16);
    return `${name}${col(n(row.initial), 4)}${col(n(row.sold), 4)}${col(n(row.losses), 4)}${col(n(row.remaining), 4)}`;
  });
  const total = (key: keyof StockRow) => stock.reduce((sum, row) => sum + n(row[key]), 0);
  const adjustment = total("remaining") - (total("initial") - total("sold") - total("losses"));
  const top = stock[0];
  const mostLeft = [...stock].sort((a, b) => n(b.remaining) - n(a.remaining))[0];
  return footer([
    ...header("SABORES DO CAIXA", `CAIXA ${cashNumber(s?.number ?? report.number)}`),
    `${dateOnly(report.service_date)}  ${timeOnly(s?.opened_at)} às ${timeOnly(s?.closed_at)}`,
    "Ordem: mais vendido primeiro",
    dashes(),
    `#B ${"SABOR".padEnd(16)} INI VEN PER SOB`,
    ...(rows.length ? rows : ["Nenhum sabor movimentado"]),
    dashes(),
    `#B ${"TOTAL".padEnd(16)}${col(total("initial"), 4)}${col(total("sold"), 4)}${col(total("losses"), 4)}${col(total("remaining"), 4)}`,
    ...(adjustment > 0 ? pair("Entradas de produção", `+${adjustment}`) : []),
    ...(adjustment < 0 ? pair("Saídas fora do caixa (site)", adjustment) : []),
    dashes(),
    "INI = no início do caixa",
    "VEN = vendidas (com cortesias)",
    "PER = perdas/descarte",
    "SOB = sobra ao fechar",
    ...(top && n(top.sold) > 0 ? [dashes(), title("Mais vendido"), ...wrap(`${top.name}: ${n(top.sold)} fatias`)] : []),
    ...(mostLeft && n(mostLeft.remaining) > 0 ? [title("Mais sobrou"), ...wrap(`${mostLeft.name}: ${n(mostLeft.remaining)} fatias`)] : []),
  ]);
}

export function dayReceipt(report: FullClosingReport): string[] {
  const day = report.day;
  if (!day || day.sessions.length < 2) return [];
  const sessions = day.sessions;
  const sum = (pick: (s: SessionSummary) => number) => sessions.reduce((total, s) => total + n(pick(s)), 0);
  const methodTotal = (code: string) => sessions.reduce((total, s) => total + s.payments.filter((p) => p.method === code).reduce((a, p) => a + n(p.amount), 0), 0);
  const amountOf = (s: SessionSummary, code: string) => s.payments.filter((p) => p.method === code).reduce((a, p) => a + n(p.amount), 0);
  const short = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const perSession = sessions.flatMap((s) => [
    `#B CAIXA ${cashNumber(s.number)} ${timeOnly(s.opened_at)}-${timeOnly(s.closed_at)}`,
    ...wrap(`${s.opened_by_name}${s.closed_by_name ? ` / ${s.closed_by_name}` : ""}`),
    ...pair(`Vendas ${s.sales_count}`, money(s.revenue)),
    ...pair(` Din ${short(amountOf(s, "cash"))}`, `Pix ${short(amountOf(s, "pix"))}`),
    ...pair(` Créd ${short(amountOf(s, "credit_card"))}`, `Déb ${short(amountOf(s, "debit_card"))}`),
    ...pair("Fatias vendidas", n(s.slices_sold)),
    ...pair(`Gaveta esp ${short(n(s.drawer.expected))}`, `cont ${s.drawer.counted == null ? "-" : short(n(s.drawer.counted))}`),
    ...pair("Diferença", signedMoney(n(s.drawer.difference))),
    dashes(),
  ]);
  const revenue = sum((s) => s.revenue);
  const salesCount = sum((s) => s.sales_count);
  const fees = sum((s) => s.fees);
  const received = sum((s) => s.received);
  return footer([
    ...header("CONSOLIDADO DO DIA", dateOnly(day.date)),
    ...wrap(`Caixas no dia: ${sessions.length} (${sessions.map((s) => String(s.number).padStart(4, "0")).join(", ")})`),
    dashes(),
    ...perSession,
    doubleLine(),
    title("Totais do dia"),
    ...pair("Vendas realizadas", salesCount),
    ...pair("Ticket médio", money(salesCount ? revenue / salesCount : 0)),
    `#B ${pair("RECEITA DO DIA", money(revenue))[0]}`,
    ...PAYMENT_ORDER.flatMap((code) => pair(methodLabel(code), money(methodTotal(code)))),
    ...pair("(-) Taxas estimadas", money(fees)),
    `#B ${pair("= LÍQUIDO", money(received - methodTotal("payroll") - fees))[0]}`,
    dashes(),
    ...pair("Fatias vendidas", sum((s) => s.slices_sold)),
    ...pair("Perdas", sum((s) => s.losses)),
    ...pair("Cortesias do Clube", sum((s) => s.rewards_count)),
    dashes(),
    ...pair("Diferença de caixa", signedMoney(sum((s) => n(s.drawer.difference)))),
    ...pair("A receber (fiado)", money(sum((s) => s.deferred_value))),
    ...(methodTotal("payroll") ? pair("A descontar em folha", money(methodTotal("payroll"))) : []),
    ...pair("Despesas em dinheiro", money(sum((s) => s.drawer.cash_expenses))),
    ...pair("Sangrias", money(sum((s) => s.drawer.withdrawals))),
    ...pair("Suprimentos", money(sum((s) => s.drawer.supplies))),
  ]);
}

/** Cupons que saem juntos no fechamento: fechamento, sabores e (se houver 2+ caixas no dia) consolidado. */
export function closingPrintJobs(report: FullClosingReport) {
  const number = cashNumber(report.summary?.number ?? report.number);
  const jobs = [
    { title: `Fechamento do caixa ${number}`, lines: closingReceipt(report) },
    { title: `Sabores do caixa ${number}`, lines: flavorsReceipt(report) },
  ];
  const day = dayReceipt(report);
  if (day.length) jobs.push({ title: `Consolidado do dia ${dateOnly(report.service_date)}`, lines: day });
  return jobs;
}
