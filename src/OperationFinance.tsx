import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, CircleDollarSign, Printer, RefreshCw, WalletCards } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import "./operation-commerce-tools.css";
import "./operation-print.css";

type SummaryRow = { code?: string; label?: string; sale_date?: string; orders: number; gross: number; fees: number; net: number };
type Summary = { from: string; to: string; orders: number; gross: number; fees: number; net: number; by_method: SummaryRow[]; by_day: SummaryRow[] };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
const monthStart = () => `${today().slice(0, 8)}01`;
const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function OperationFinance() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    const { data, error } = await requireSupabase().rpc("staff_financial_sales_summary", { range_start: from, range_end: to });
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice(""); setSummary(data as Summary);
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);
  const average = useMemo(() => summary?.orders ? summary.gross / summary.orders : 0, [summary]);

  return <section className="commerce-finance-page print-scope">
    <header className="commerce-tool-heading"><div><small>Vendas e recebimentos</small><h2>Financeiro</h2><p>Faturamento bruto, taxas e valor líquido no período escolhido.</p></div><button onClick={() => window.print()}><Printer /> Imprimir ou salvar em PDF</button></header>
    <div className="commerce-period-filter"><label><CalendarRange /> De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button onClick={() => void load()} disabled={busy}><RefreshCw /> Atualizar</button></div>
    {notice ? <p className="operation-commercial-notice">{notice}</p> : null}
    {summary ? <>
      <div className="commerce-finance-metrics">
        <span><small>Vendas</small><strong>{summary.orders}</strong></span><span><small>Faturamento bruto</small><strong>{money(summary.gross)}</strong></span><span><small>Taxas</small><strong>{money(summary.fees)}</strong></span><span><small>Valor líquido</small><strong>{money(summary.net)}</strong></span><span><small>Ticket médio</small><strong>{money(average)}</strong></span>
      </div>
      <div className="commerce-report-grid">
        <section className="commerce-tool-card"><header><WalletCards /><div><small>Comparativo</small><h3>Por meio de pagamento</h3></div></header><table><thead><tr><th>Meio</th><th>Vendas</th><th>Bruto</th><th>Taxas</th><th>Líquido</th></tr></thead><tbody>{summary.by_method.map((row) => <tr key={row.code}><td>{row.label}</td><td>{row.orders}</td><td>{money(row.gross)}</td><td>{money(row.fees)}</td><td>{money(row.net)}</td></tr>)}</tbody></table>{!summary.by_method.length ? <p>Nenhuma venda paga neste período.</p> : null}</section>
        <section className="commerce-tool-card"><header><CircleDollarSign /><div><small>Movimento</small><h3>Vendas por dia</h3></div></header><table><thead><tr><th>Dia</th><th>Vendas</th><th>Bruto</th><th>Líquido</th></tr></thead><tbody>{summary.by_day.map((row) => <tr key={row.sale_date}><td>{new Date(`${row.sale_date}T12:00:00`).toLocaleDateString("pt-BR")}</td><td>{row.orders}</td><td>{money(row.gross)}</td><td>{money(row.net)}</td></tr>)}</tbody></table></section>
      </div>
    </> : null}
  </section>;
}
