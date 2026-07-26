import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  Clock3,
  Gift,
  RefreshCw,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import "./operation-reports.css";

type StoreRow = { id: string; name: string; active: boolean };
type BusinessWorkspace = { stores?: StoreRow[] };

type ReportsData = {
  period: { from: string; to: string; store_id: string | null };
  summary: {
    orders: number;
    approved_orders: number;
    gross: number;
    fees: number;
    net: number;
    average_ticket: number;
    new_customers: number;
    stamps_added: number;
    stamps_removed: number;
    rewards_redeemed: number;
    manual_adjustments: number;
    checkins: number;
    claimed_checkins: number;
    expired_checkins: number;
    cash_sessions: number;
    cash_divergent_sessions: number;
    cash_absolute_difference: number;
    cash_net_difference: number;
  };
  sales_by_day: Array<{ sale_date: string; orders: number; gross: number; fees: number; net: number }>;
  payment_methods: Array<{ code: string; label: string; orders: number; gross: number; net: number }>;
  stores: Array<{ store_id: string | null; store_name: string; orders: number; gross: number; net: number }>;
  top_products: Array<{ flavor_id: string | null; product_name: string; quantity: number; gross: number }>;
  loyalty_reasons: Array<{ reason: string; movements: number; net_stamps: number }>;
};

const localDateKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(date);

const rangeFromDays = (days: number) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - Math.max(0, days - 1));
  return { from: localDateKey(start), to: localDateKey(end) };
};

const money = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const number = (value: number) => Number(value || 0).toLocaleString("pt-BR");

export default function OperationReports() {
  const initialRange = rangeFromDays(7);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [storeId, setStoreId] = useState("");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [report, setReport] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const loadStores = useCallback(async () => {
    try {
      const workspace = await bffRpc<BusinessWorkspace>("staff_get_business_workspace");
      setStores((workspace.stores || []).filter((store) => store.active));
    } catch {
      setStores([]);
    }
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const data = await bffRpc<ReportsData>("staff_get_operational_reports", {
        range_start: from,
        range_end: to,
        target_store_id: storeId || null,
      });
      setReport({
        ...data,
        summary: Object.fromEntries(
          Object.entries(data.summary || {}).map(([key, value]) => [key, Number(value || 0)]),
        ) as ReportsData["summary"],
        sales_by_day: (data.sales_by_day || []).map((row) => ({ ...row, orders: Number(row.orders || 0), gross: Number(row.gross || 0), fees: Number(row.fees || 0), net: Number(row.net || 0) })),
        payment_methods: (data.payment_methods || []).map((row) => ({ ...row, orders: Number(row.orders || 0), gross: Number(row.gross || 0), net: Number(row.net || 0) })),
        stores: (data.stores || []).map((row) => ({ ...row, orders: Number(row.orders || 0), gross: Number(row.gross || 0), net: Number(row.net || 0) })),
        top_products: (data.top_products || []).map((row) => ({ ...row, quantity: Number(row.quantity || 0), gross: Number(row.gross || 0) })),
        loyalty_reasons: (data.loyalty_reasons || []).map((row) => ({ ...row, movements: Number(row.movements || 0), net_stamps: Number(row.net_stamps || 0) })),
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível gerar os relatórios.");
    } finally {
      setLoading(false);
    }
  }, [from, to, storeId]);

  useEffect(() => {
    void loadStores();
    void loadReport();
  }, [loadStores, loadReport]);

  const maxDailyGross = useMemo(
    () => Math.max(1, ...(report?.sales_by_day || []).map((row) => row.gross)),
    [report],
  );
  const maxProductQuantity = useMemo(
    () => Math.max(1, ...(report?.top_products || []).map((row) => row.quantity)),
    [report],
  );
  const cashStatus = useMemo(() => {
    if (!report) return "Sem dados";
    if (!report.summary.cash_divergent_sessions) return "Sem divergências";
    return `${report.summary.cash_divergent_sessions} fechamento(s) divergente(s)`;
  }, [report]);

  const applyPreset = (days: number) => {
    const next = rangeFromDays(days);
    setFrom(next.from);
    setTo(next.to);
  };

  return (
    <section className="operation-reports" aria-label="Relatórios da operação">
      <header className="operation-reports-heading">
        <div>
          <small>Decisões rápidas com números claros</small>
          <h2>Relatórios da Adoce</h2>
          <p>Vendas, clientes, fidelidade, check-ins e caixa no mesmo painel.</p>
        </div>
        <ChartNoAxesCombined aria-hidden="true" />
      </header>

      <div className="operation-reports-filters">
        <div className="operation-reports-presets">
          <button type="button" onClick={() => applyPreset(1)}>Hoje</button>
          <button type="button" onClick={() => applyPreset(7)}>7 dias</button>
          <button type="button" onClick={() => applyPreset(30)}>30 dias</button>
          <button type="button" onClick={() => applyPreset(90)}>90 dias</button>
        </div>
        <label>De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <label>Loja<select value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="">Todas acessíveis</option>{stores.map((store) => <option value={store.id} key={store.id}>{store.name}</option>)}</select></label>
        <button className="operation-reports-refresh" type="button" onClick={() => void loadReport()} disabled={loading}><RefreshCw /> {loading ? "Atualizando…" : "Atualizar"}</button>
      </div>

      {notice ? <p className="operation-reports-notice" role="status">{notice}</p> : null}
      {!report && loading ? <p className="operation-reports-empty">Gerando visão consolidada…</p> : null}

      {report ? (
        <>
          <section className="operation-reports-metrics">
            <article><CircleDollarSign /><span><small>Vendas brutas</small><strong>{money(report.summary.gross)}</strong><em>{number(report.summary.orders)} pedido(s)</em></span></article>
            <article><BadgeDollarSign /><span><small>Valor líquido</small><strong>{money(report.summary.net)}</strong><em>{money(report.summary.fees)} em taxas</em></span></article>
            <article><ShoppingBag /><span><small>Ticket médio</small><strong>{money(report.summary.average_ticket)}</strong><em>{number(report.summary.approved_orders)} aprovado(s)</em></span></article>
            <article><Users /><span><small>Novos clientes</small><strong>{number(report.summary.new_customers)}</strong><em>{number(report.summary.checkins)} check-in(s)</em></span></article>
            <article><Gift /><span><small>Carimbos adicionados</small><strong>{number(report.summary.stamps_added)}</strong><em>{number(report.summary.rewards_redeemed)} prêmio(s) resgatado(s)</em></span></article>
            <article><Clock3 /><span><small>Fechamentos de caixa</small><strong>{number(report.summary.cash_sessions)}</strong><em>{cashStatus}</em></span></article>
          </section>

          <div className="operation-reports-grid">
            <section className="operation-reports-card sales-chart">
              <header><div><h3>Vendas por dia</h3><p>Bruto e quantidade de pedidos no período.</p></div><CalendarDays /></header>
              <div className="operation-reports-bars">
                {report.sales_by_day.length ? report.sales_by_day.map((row) => (
                  <article key={row.sale_date}>
                    <div><strong>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${row.sale_date}T12:00:00Z`))}</strong><small>{row.orders} pedido(s)</small></div>
                    <span><i style={{ width: `${Math.max(4, (row.gross / maxDailyGross) * 100)}%` }} /></span>
                    <b>{money(row.gross)}</b>
                  </article>
                )) : <p>Nenhuma venda aprovada no período.</p>}
              </div>
            </section>

            <section className="operation-reports-card">
              <header><div><h3>Produtos mais vendidos</h3><p>Quantidade registrada nos pedidos aprovados.</p></div><ShoppingBag /></header>
              <div className="operation-reports-ranking">
                {report.top_products.length ? report.top_products.map((row, index) => (
                  <article key={`${row.flavor_id || row.product_name}-${index}`}>
                    <b>{index + 1}</b><span><strong>{row.product_name}</strong><i><em style={{ width: `${Math.max(6, (row.quantity / maxProductQuantity) * 100)}%` }} /></i></span><span><strong>{row.quantity}</strong><small>{money(row.gross)}</small></span>
                  </article>
                )) : <p>Nenhum produto contabilizado.</p>}
              </div>
            </section>

            <section className="operation-reports-card">
              <header><div><h3>Formas de pagamento</h3><p>Participação por valor bruto.</p></div><BadgeDollarSign /></header>
              <div className="operation-reports-table">
                {report.payment_methods.length ? report.payment_methods.map((row) => (
                  <article key={row.code}><span><strong>{row.label}</strong><small>{row.orders} pedido(s)</small></span><span><b>{money(row.gross)}</b><small>Líquido {money(row.net)}</small></span></article>
                )) : <p>Sem pagamentos aprovados.</p>}
              </div>
            </section>

            <section className="operation-reports-card">
              <header><div><h3>Desempenho por loja</h3><p>Somente lojas permitidas para a sessão atual.</p></div><Store /></header>
              <div className="operation-reports-table">
                {report.stores.length ? report.stores.map((row) => (
                  <article key={row.store_id || "unassigned"}><span><strong>{row.store_name}</strong><small>{row.orders} pedido(s)</small></span><span><b>{money(row.gross)}</b><small>Líquido {money(row.net)}</small></span></article>
                )) : <p>Sem vendas vinculadas a lojas.</p>}
              </div>
            </section>
          </div>

          <section className="operation-reports-footer">
            <article><small>Ajustes manuais de carimbos</small><strong>{number(report.summary.manual_adjustments)}</strong></article>
            <article><small>Carimbos removidos</small><strong>{number(report.summary.stamps_removed)}</strong></article>
            <article><small>Check-ins atendidos</small><strong>{number(report.summary.claimed_checkins)}</strong></article>
            <article><small>Check-ins expirados</small><strong>{number(report.summary.expired_checkins)}</strong></article>
            <article><small>Diferença absoluta de caixa</small><strong>{money(report.summary.cash_absolute_difference)}</strong></article>
            <article><small>Saldo das diferenças</small><strong>{money(report.summary.cash_net_difference)}</strong></article>
          </section>
        </>
      ) : null}
    </section>
  );
}
