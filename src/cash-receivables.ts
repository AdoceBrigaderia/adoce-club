export const paymentLabels: Record<string, string> = { cash: "Dinheiro", pix: "Pix", credit_card: "Crédito", debit_card: "Débito", payroll: "Desconto em folha" };
export function splitChange(total: number, pix: number) {
  if (!Number.isFinite(pix) || pix < 0 || pix > total) throw new Error("O troco por Pix deve estar entre zero e o troco total.");
  return { cash: Math.round((total - pix) * 100) / 100, pix: Math.round(pix * 100) / 100 };
}
export const cashMoney = (value: number) => `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
// Basta o primeiro nome (ex.: "Myrna"); o sobrenome ajuda, mas não é obrigatório.
export const validateDeferredSale = (name: string) => name.trim().split(/\s+/).some(part => part.length > 1) ? "" : "Informe o nome do cliente.";
export type ClosingReport = {
  session: { id: string; opening_float: number; counted_cash?: number; expected_cash?: number; cash_difference?: number };
  slices: Array<{ name: string; quantity: number }>;
  payments: Array<{ method: string; amount: number }>;
  pending: Array<{ customer_name: string; order_number: string; remaining: number }>;
  expenses?: Array<{ description: string; method: string; amount: number }>;
  pix_change?: Array<{ source: string; amount: number }>;
};
export function closingReceipt(report: ClosingReport) {
  return ["ADOCE BRIGADERIA", "FECHAMENTO DE CAIXA", `Caixa: ${report.session.id}`, "--------------------------------", ...report.slices.map(item => `${item.name}: ${item.quantity}`), `TOTAL DE FATIAS: ${report.slices.reduce((sum, item) => sum + Number(item.quantity), 0)}`, "--------------------------------", "RECEBIMENTOS NESTE CAIXA", ...Object.entries(paymentLabels).map(([method, label]) => `${label}: ${cashMoney(report.payments.filter(item => item.method === method).reduce((sum, item) => sum + Number(item.amount), 0))}`), "Inclui pagamentos de vendas anteriores.", "--------------------------------", `Fundo inicial: ${cashMoney(report.session.opening_float)}`, `Dinheiro esperado: ${cashMoney(report.session.expected_cash || 0)}`, `Dinheiro contado: ${cashMoney(report.session.counted_cash || 0)}`, `Diferença: ${cashMoney(report.session.cash_difference || 0)}`, "--------------------------------", "PAGAMENTOS PENDENTES", ...(report.pending.length ? report.pending.flatMap(item => [item.customer_name, `${item.order_number}: ${cashMoney(item.remaining)}`]) : ["Nenhum"]), `TOTAL PENDENTE: ${cashMoney(report.pending.reduce((sum, item) => sum + Number(item.remaining), 0))}`, "Pendências não são dinheiro recebido.", "--------------------------------", "DESPESAS", ...(report.expenses?.length ? report.expenses.map(item => `${item.description} · ${paymentLabels[item.method] || item.method}: ${cashMoney(item.amount)}`) : ["Nenhuma"]), "--------------------------------", "TROCO DEVOLVIDO POR PIX", ...(report.pix_change?.length ? report.pix_change.map(item => `${item.source}: ${cashMoney(item.amount)}`) : ["Nenhum"]), "Troco por Pix não sai da gaveta.", ""].join("\n");
}
