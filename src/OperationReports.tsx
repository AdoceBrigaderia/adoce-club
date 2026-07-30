import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
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
import OperationReportBreakdowns from "./OperationReportBreakdowns";
import type { OperationalReportBreakdownPayload } from "./operational-report-breakdowns";
import { bffRpc } from "./services/bff-rpc";
import "./operation-reports.css";

type StoreRow = { id: string; name: string; active: boolean };
type BusinessWorkspace = { stores?: StoreRow[] };
type NullableNumber = number | null;

type ReportsData = OperationalReportBreakdownPayload & {
  period: { from: string; to: string; store_id: string | null };
  capabilities: {
    finance_authorized: boolean;
    finance_scope_complete: boolean;
    global_metrics_authorized: boolean;
  };
  summary: {
    orders: number;
    approved_orders: number;
    unassigned_orders: NullableNumber;
    gross: NullableNumber;
    fees: NullableNumber;
    net: NullableNumber;
    average_ticket: NullableNumber;
    new_customers: NullableNumber;
    stamps_added: NullableNumber;
    stamps_removed: NullableNumber;
    rewards_redeemed: NullableNumber;
    manual_adjustments: NullableNumber;
    checkins: number;
    claimed_checkins: number;
    expired_checkins: number;
    cash_sessions: number;
    cash_divergent_sessions: NullableNumber;
    cash_absolute_difference: NullableNumber;
    cash_net_difference: NullableNumber;
    cash_expenses: NullableNumber;
    cash_refunds: NullableNumber;
    cash_supplies: NullableNumber;
    cash_withdrawals: NullableNumber;
    service_requests: number;
    service_requests_active: number;
    service_requests_ready: number;
    service_requests_completed: number;
    service_requests_cancelled: number;
    service_requests_paid_amount: NullableNumber;
    service_requests_refund_pending_amount: NullableNumber;
  };
  sales_by_day: Array<{
    sale_date: string;
    orders: number;
    gross: NullableNumber;
    fees: NullableNumber;
    net: NullableNumber;
  }>;
  payment_methods: Array<{
    code: string;
    label: string;
    orders: number;
    gross: number;
    net: number;
  }>;
  stores: Array<{
    store_id: string;
    store_name: string;
    finance_authorized: boolean;
    orders: number;
    gross: NullableNumber;
    net: NullableNumber;
  }>;
  top_products: Array<{
    flavor_id: string | null;
    product_name: string;
    quantity: number;
    gross: NullableNumber;
  }>;
  loyalty_reasons: Array<{ reason: string; movements: number; net_stamps: number }>;
  service_requests_by_status: Array<{ status: string; requests: number }>;
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
const nullableNumber = (value: unknown): NullableNumber =>
  value === null || value === undefined ? null : Number(value || 0);
const moneyOrProtected = (value: NullableNumber) =>
  value === null ? "Protegido por permissão" : money(value);
const numberOrUnavailable = (value: NullableNumber) =>
  value === null ? "Somente visão global" : number(value);

const serviceRequestStatusLabel = (status: string) =>
  ({
    prebooked: "Pré-reserva",
    quoted: "Orçada",
    awaiting_deposit: "Aguardando sinal",
    confirmed: "Confirmada",
    in_production: "Em produção",
    ready: "Pronta",
    completed: "Concluída",
    cancelled: "Cancelada",
  })[status] || status;

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
        capabilities: {
          finance_authorized: Boolean(data.capabilities?.finance_authorized),
          finance_scope_complete: Boolean(data.capabilities?.finance_scope_complete),
          global_metrics_authorized: Boolean(data.capabilities?.global_metrics_authorized),
        },
        summary: Object.fromEntries(
          Object.entries(data.summary || {}).map(([key, value]) => [key, nullableNumber(value)]),
        ) as ReportsData["summary"],
        sales_by_day: (data.sales_by_day || []).map((row) => ({
          ...row,
          orders: Number(row.orders || 0),
          gross: nullableNumber(row.gross),
          fees: nullableNumber(row.fees),
          net: nullableNumber(row.net),
        })),
        payment_methods: (data.payment_methods || []).map((row) => ({
          ...row,
          orders: Number(row.orders || 0),
          gross: Number(row.gross || 0),
          net: Number(row.net || 0),
        })),
        stores: (data.stores || []).map((row) => ({
          ...row,
          finance_authorized: Boolean(row.finance_authorized),
          orders: Number(row.orders || 0),
          gross: nullableNumber(row.gross),
          net: nullableNumber(row.net),
        })),
        top_products: (data.top_products || []).map((row) => ({
          ...row,
          quantity: Number(row.quantity || 0),
          gross: nullableNumber(row.gross),
        })),
        loyalty_reasons: (data.loyalty_reasons || []).map((row) => ({
          ...row,
          movements: Number(row.movements || 0),
          net_stamps: Number(row.net_stamps || 0),
        })),
        service_requests_by_status: (data.service_requests_by_status || []).map((row) => ({
          ...row,
          requests: Number(row.requests || 0),
        })),
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

  const maxDailyValue = useMemo(
    () =>
      Math.max(
        1,
        ...(report?.sales_by_day || []).map((row) =>
          report?.capabilities.finance_scope_complete ? row.gross || 0 : row.orders,
        ),
      ),
    [report],
  );
  const maxProductQuantity = useMemo(
    () => Math.max(1, ...(report?.top_products || []).map((row) => row.quantity)),
    [report],
  );
  const cashStatus = useMemo(() => {
    if (!report) return "Sem dados";
    if (report.summary.cash_divergent_sessions === null) return "Valores protegidos";
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
          <p>Vendas, encomendas, fidelidade, check-ins e caixa no mesmo painel.</p>
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
        <label>
          De
          <input
            type="date"
            value={from}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setFrom(event.target.value)}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={to}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setTo(event.target.value)}
          />
        </label>
        <label>
          Loja
          <select
            value={storeId}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setStoreId(event.target.value)}
          >
            <option value="">Todas acessíveis</option>
            {stores.map((store) => (
              <option value={store.id} key={store.id}>{store.name}</option>
            ))}
          </select>
        </label>
        <button
          className="operation-reports-refresh"
          type="button"
          onClick={() => void loadReport()}
          disabled={loading}
        >
          <RefreshCw /> {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {notice ? <p className="operation-reports-notice" role="status">{notice}</p> : null}
      {!report && loading ? <p className="operation-reports-empty">Gerando visão consolidada…</p> : null}
      {report && !report.capabilities.finance_scope_complete ? (
        <p className="operation-reports-notice" role="status">
          Valores, formas de pagamento e diferenças de caixa ficam ocultos quando a sessão não possui
          <strong> view_finance</strong> em todas as lojas selecionadas. Quantidades operacionais permanecem disponíveis.
        </p>
      ) : null}

      {report ? (
        <>
          <section className="operation-reports-metrics">
            <article><CircleDollarSign /><span><small>Vendas brutas</small><strong>{moneyOrProtected(report.summary.gross)}</strong><em>{number(report.summary.orders)} pedido(s)</em></span></article>
            <article><BadgeDollarSign /><span><small>Valor líquido</small><strong>{moneyOrProtected(report.summary.net)}</strong><em>{report.summary.fees === null ? "Taxas protegidas" : `${money(report.summary.fees)} em taxas`}</em></span></article>
            <article><ShoppingBag /><span><small>Ticket médio</small><strong>{moneyOrProtected(report.summary.average_ticket)}</strong><em>{number(report.summary.approved_orders)} aprovado(s)</em></span></article>
            <article><Users /><span><small>Novos clientes</small><strong>{numberOrUnavailable(report.summary.new_customers)}</strong><em>{number(report.summary.checkins)} check-in(s)</em></span></article>
            <article><Gift /><span><small>Carimbos adicionados</small><strong>{numberOrUnavailable(report.summary.stamps_added)}</strong><em>{report.summary.rewards_redeemed === null ? "Somente visão global" : `${number(report.summary.rewards_redeemed)} prêmio(s) resgatado(s)`}</em></span></article>
            <article><Clock3 /><span><small>Fechamentos de caixa</small><strong>{number(report.summary.cash_sessions)}</strong><em>{cashStatus}</em></span></article>
          </section>

          <section className="operation-reports-footer" aria-label="Resumo das encomendas">
            <article><small>Encomendas no período</small><strong>{number(report.summary.service_requests)}</strong></article>
            <article><small>Em andamento</small><strong>{number(report.summary.service_requests_active)}</strong></article>
            <article><small>Prontas</small><strong>{number(report.summary.service_requests_ready)}</strong></article>
            <article><small>Concluídas</small><strong>{number(report.summary.service_requests_completed)}</strong></article>
            <article><small>Canceladas</small><strong>{number(report.summary.service_requests_cancelled)}</strong></article>
            <article><small>Recebido em encomendas</small><strong>{moneyOrProtected(report.summary.service_requests_paid_amount)}</strong></article>
          </section>

          <OperationReportBreakdowns report={report} />

          <div className="operation-reports-grid">
            <section className="operation-reports-card sales-chart">
              <header><div><h3>Vendas por dia</h3><p>{report.capabilities.finance_scope_complete ? "Bruto e quantidade de pedidos no período." : "Quantidade de pedidos no período; valores protegidos."}</p></div><CalendarDays /></header>
              <div className="operation-reports-bars">
                {report.sales_by_day.length ? report.sales_by_day.map((row) => {
                  const dailyValue = report.capabilities.finance_scope_complete ? row.gross || 0 : row.orders;
                  return (
                    <article key={row.sale_date}>
                      <div><strong>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${row.sale_date}T12:00:00Z`))}</strong><small>{row.orders} pedido(s)</small></div>
                      <span><i style={{ width: `${Math.max(4, (dailyValue / maxDailyValue) * 100)}%` }} /></span>
                      <b>{moneyOrProtected(row.gross)}</b>
                    </article>
                  );
                }) : <p>Nenhuma venda aprovada no período.</p>}
              </div>
            </section>

            <section className="operation-reports-card">
              <header><div><h3>Produtos mais vendidos</h3><p>Quantidade registrada nos pedidos aprovados.</p></div><ShoppingBag /></header>
              <div className="operation-reports-ranking">
                {report.top_products.length ? report.top_products.map((row, index) => (
                  <article key={`${row.flavor_id || row.product_name}-${index}`}>
                    <b>{index + 1}</b><span><strong>{row.product_name}</strong><i><em style={{ width: `${Math.max(6, (row.quantity / maxProductQuantity) * 100)}%` }} /></i></span><span><strong>{row.quantity}</strong><small>{moneyOrProtected(row.gross)}</small></span>
                  </article>
                )) : <p>Nenhum produto contabilizado.</p>}
              </div>
            </section>

            <section className="operation-reports-card">
              <header><div><h3>Formas de pagamento</h3><p>Disponíveis somente com visão financeira em todo o escopo.</p></div><BadgeDollarSign /></header>
              <div className="operation-reports-table">
                {!report.capabilities.finance_scope_complete ? <p>Requer permissão financeira em todas as lojas selecionadas.</p> : report.payment_methods.length ? report.payment_methods.map((row) => (
                  <article key={row.code}><span><strong>{row.label}</strong><small>{row.orders} pedido(s)</small></span><span><b>{money(row.gross)}</b><small>Líquido {money(row.net)}</small></span></article>
                )) : <p>Sem pagamentos aprovados.</p>}
              </div>
            </section>

            <section className="operation-reports-card">
              <header><div><h3>Desempenho por loja</h3><p>Quantidade sempre visível; valores seguem a permissão de cada unidade.</p></div><Store /></header>
              <div className="operation-reports-table">
                {report.stores.length ? report.stores.map((row) => (
                  <article key={row.store_id}><span><strong>{row.store_name}</strong><small>{row.orders} pedido(s)</small></span><span><b>{moneyOrProtected(row.gross)}</b><small>{row.net === null ? "Financeiro protegido" : `Líquido ${money(row.net)}`}</small></span></article>
                )) : <p>Sem lojas acessíveis no período.</p>}
              </div>
            </section>

            <section className="operation-reports-card">
              <header><div><h3>Encomendas por etapa</h3><p>Fila operacional filtrada pela loja antes da agregação.</p></div><ShoppingBag /></header>
              <div className="operation-reports-table">
                {report.service_requests_by_status.length ? report.service_requests_by_status.map((row) => (
                  <article key={row.status}><span><strong>{serviceRequestStatusLabel(row.status)}</strong><small>Status operacional</small></span><span><b>{number(row.requests)}</b><small>encomenda(s)</small></span></article>
                )) : <p>Sem encomendas criadas no período.</p>}
              </div>
            </section>

            <section className="operation-reports-card">
              <header><div><h3>Movimentações de caixa</h3><p>Saídas, estornos e reforços calculados no backend.</p></div><CircleDollarSign /></header>
              <div className="operation-reports-table">
                <article><span><strong>Despesas</strong><small>Saídas registradas</small></span><b>{moneyOrProtected(report.summary.cash_expenses)}</b></article>
                <article><span><strong>Estornos</strong><small>Devoluções registradas</small></span><b>{moneyOrProtected(report.summary.cash_refunds)}</b></article>
                <article><span><strong>Suprimentos</strong><small>Entradas de reforço</small></span><b>{moneyOrProtected(report.summary.cash_supplies)}</b></article>
                <article><span><strong>Sangrias</strong><small>Retiradas do caixa</small></span><b>{moneyOrProtected(report.summary.cash_withdrawals)}</b></article>
              </div>
            </section>
          </div>

          <section className="operation-reports-footer">
            <article><small>Ajustes manuais de carimbos</small><strong>{numberOrUnavailable(report.summary.manual_adjustments)}</strong></article>
            <article><small>Carimbos removidos</small><strong>{numberOrUnavailable(report.summary.stamps_removed)}</strong></article>
            <article><small>Check-ins atendidos</small><strong>{number(report.summary.claimed_checkins)}</strong></article>
            <article><small>Check-ins expirados</small><strong>{number(report.summary.expired_checkins)}</strong></article>
            <article><small>Diferença absoluta de caixa</small><strong>{moneyOrProtected(report.summary.cash_absolute_difference)}</strong></article>
            <article><small>Estorno pendente em encomendas</small><strong>{moneyOrProtected(report.summary.service_requests_refund_pending_amount)}</strong></article>
          </section>
        </>
      ) : null}
    </section>
  );
}
