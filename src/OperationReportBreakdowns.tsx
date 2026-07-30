import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeDollarSign,
  MonitorSmartphone,
  Store,
  UserRound,
} from "lucide-react";
import {
  changeOperationalReportFilter,
  channelLabel,
  normalizeOperationalReportBreakdowns,
  normalizeOperationalReportFilterOptions,
  normalizeOperationalReportFilters,
  normalizeOperationalReportPeriod,
  type NullableNumber,
  type OperationalReportBreakdownPayload,
  type OperationalReportFilterKey,
  type OperationalReportFilterOption,
  type OperationalReportFilters,
} from "./operational-report-breakdowns";
import { bffRpc } from "./services/bff-rpc";
import "./operation-report-breakdown-filters.css";

type Props = {
  report: OperationalReportBreakdownPayload;
};

type FilterGroupProps = {
  label: string;
  activeValue: string | null;
  options: OperationalReportFilterOption[];
  onChange: (value: string | null) => void;
};

const money = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const number = (value: number) => Number(value || 0).toLocaleString("pt-BR");
const moneyOrProtected = (value: NullableNumber) =>
  value === null ? "Protegido por permissão" : money(value);

function FilterGroup({
  label,
  activeValue,
  options,
  onChange,
}: FilterGroupProps) {
  return (
    <div className="operation-report-filter-group" role="group" aria-label={label}>
      <strong>{label}</strong>
      <div className="operation-report-filter-chips">
        <button
          type="button"
          aria-pressed={activeValue === null}
          onClick={() => onChange(null)}
        >
          Todos
        </button>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            aria-pressed={activeValue === option.value}
            title={option.storeName ? `${option.label} · ${option.storeName}` : option.label}
            onClick={() => onChange(option.value)}
          >
            {option.label}{option.storeName ? ` · ${option.storeName}` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function OperationReportBreakdowns({ report }: Props) {
  const [scopedReport, setScopedReport] = useState<OperationalReportBreakdownPayload>(report);
  const [filters, setFilters] = useState<OperationalReportFilters>(() =>
    normalizeOperationalReportFilters(report),
  );
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    requestSequence.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setScopedReport(report);
    setFilters(normalizeOperationalReportFilters(report));
    setNotice("");
    setLoading(false);
  }, [report]);

  useEffect(() => () => {
    requestSequence.current += 1;
    activeRequest.current?.abort();
  }, []);

  const breakdowns = useMemo(
    () => normalizeOperationalReportBreakdowns(scopedReport),
    [scopedReport],
  );
  const options = useMemo(
    () => normalizeOperationalReportFilterOptions(scopedReport),
    [scopedReport],
  );
  const period = useMemo(
    () => normalizeOperationalReportPeriod(scopedReport),
    [scopedReport],
  );

  const applyFilter = async (
    key: OperationalReportFilterKey,
    value: string | null,
  ) => {
    const nextFilters = changeOperationalReportFilter(filters, key, value, options);
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setFilters(nextFilters);
    setLoading(true);
    setNotice("");

    try {
      const nextReport = await bffRpc<OperationalReportBreakdownPayload>(
        "staff_get_operational_reports",
        {
          range_start: period.from,
          range_end: period.to,
          target_store_id: period.storeId,
          target_channel: nextFilters.channel,
          target_operator_user_id: nextFilters.operatorUserId,
          target_register_id: nextFilters.registerId,
        },
        { signal: controller.signal },
      );
      if (requestId !== requestSequence.current) return;
      setScopedReport(nextReport);
      setFilters(normalizeOperationalReportFilters(nextReport));
    } catch (error) {
      if (controller.signal.aborted || requestId !== requestSequence.current) return;
      setFilters(normalizeOperationalReportFilters(scopedReport));
      setNotice(error instanceof Error ? error.message : "Não foi possível aplicar o filtro.");
    } finally {
      if (requestId === requestSequence.current) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  };

  const channelOptions = options.channels.length
    ? options.channels
    : [
        { value: "online", label: channelLabel("online"), storeId: null, storeName: null },
        { value: "presencial", label: channelLabel("presencial"), storeId: null, storeName: null },
      ];

  return (
    <section
      className="operation-report-breakdowns"
      aria-label="Detalhamentos operacionais"
      data-touch-budget="1"
      data-filter-request-mode="latest-wins"
      aria-busy={loading}
    >
      <header className="operation-report-breakdowns-heading">
        <div>
          <small>Troque o recorte com um toque</small>
          <h3>Detalhamento da operação</h3>
          <p>Os filtros abaixo afetam somente estes quatro detalhamentos; o resumo geral permanece consolidado.</p>
        </div>
      </header>

      <div className="operation-report-quick-filters" aria-label="Filtros rápidos do detalhamento">
        <FilterGroup
          label="Canal"
          activeValue={filters.channel}
          options={channelOptions}
          onChange={(value) => void applyFilter("channel", value)}
        />
        <FilterGroup
          label="Operador"
          activeValue={filters.operatorUserId}
          options={options.operators}
          onChange={(value) => void applyFilter("operatorUserId", value)}
        />
        <FilterGroup
          label="Caixa"
          activeValue={filters.registerId}
          options={options.registers}
          onChange={(value) => void applyFilter("registerId", value)}
        />
      </div>

      {notice ? <p className="operation-report-filter-notice" role="status" aria-live="polite">{notice}</p> : null}
      {loading ? <p className="operation-report-filter-status" role="status" aria-live="polite">Atualizando recorte…</p> : null}

      <div className="operation-report-breakdowns-grid">
        <article className="operation-reports-card operation-report-breakdown-card">
          <header>
            <div>
              <h3>Vendas por canal</h3>
              <p>On-line e presencial no período selecionado.</p>
            </div>
            <MonitorSmartphone aria-hidden="true" />
          </header>
          <div className="operation-reports-table">
            {breakdowns.ordersByChannel.length ? (
              breakdowns.ordersByChannel.map((row) => (
                <article key={row.channel}>
                  <span>
                    <strong>{channelLabel(row.channel)}</strong>
                    <small>{number(row.orders)} pedido(s)</small>
                  </span>
                  <span>
                    <b>{moneyOrProtected(row.gross)}</b>
                    <small>
                      {row.net === null
                        ? "Financeiro protegido"
                        : `Líquido ${money(row.net)}`}
                    </small>
                  </span>
                </article>
              ))
            ) : (
              <p>Sem vendas no recorte selecionado.</p>
            )}
          </div>
        </article>

        <article className="operation-reports-card operation-report-breakdown-card">
          <header>
            <div>
              <h3>Vendas por caixa</h3>
              <p>Movimento presencial por unidade e caixa físico.</p>
            </div>
            <Store aria-hidden="true" />
          </header>
          <div className="operation-reports-table">
            {breakdowns.salesByCashRegister.length ? (
              breakdowns.salesByCashRegister.map((row) => (
                <article key={`${row.store_id}-${row.register_id}`}>
                  <span>
                    <strong>{row.register_name}</strong>
                    <small>{row.store_name} · {number(row.orders)} pedido(s)</small>
                  </span>
                  <span>
                    <b>{moneyOrProtected(row.gross)}</b>
                    <small>
                      {row.net === null
                        ? "Financeiro protegido"
                        : `Líquido ${money(row.net)}`}
                    </small>
                  </span>
                </article>
              ))
            ) : (
              <p>Sem vendas por caixa no recorte selecionado.</p>
            )}
          </div>
        </article>

        <article className="operation-reports-card operation-report-breakdown-card">
          <header>
            <div>
              <h3>Vendas por operador</h3>
              <p>Quantidade presencial registrada por pessoa.</p>
            </div>
            <UserRound aria-hidden="true" />
          </header>
          <div className="operation-reports-table">
            {breakdowns.salesByOperator.length ? (
              breakdowns.salesByOperator.map((row) => (
                <article key={`${row.store_id}-${row.operator_user_id || row.operator_name}`}>
                  <span>
                    <strong>{row.operator_name}</strong>
                    <small>{row.store_name} · {number(row.orders)} pedido(s)</small>
                  </span>
                  <span>
                    <b>{moneyOrProtected(row.gross)}</b>
                    <small>
                      {row.gross === null ? "Financeiro protegido" : "Venda presencial"}
                    </small>
                  </span>
                </article>
              ))
            ) : (
              <p>Sem vendas por operador no recorte selecionado.</p>
            )}
          </div>
        </article>

        <article className="operation-reports-card operation-report-breakdown-card">
          <header>
            <div>
              <h3>Sessões por caixa</h3>
              <p>Aberturas, fechamentos e divergências por caixa.</p>
            </div>
            <BadgeDollarSign aria-hidden="true" />
          </header>
          <div className="operation-reports-table operation-report-cash-sessions">
            {breakdowns.cashSessionsByRegister.length ? (
              breakdowns.cashSessionsByRegister.map((row) => (
                <article key={`${row.store_id}-${row.register_id}`}>
                  <span>
                    <strong>{row.register_name}</strong>
                    <small>
                      {row.store_name} · {number(row.open_sessions)} aberta(s) · {number(row.closed_sessions)} fechada(s)
                    </small>
                  </span>
                  <span>
                    <b>{number(row.sessions)} sessão(ões)</b>
                    <small>
                      {row.divergent_sessions === null
                        ? "Divergências protegidas"
                        : `${number(row.divergent_sessions)} divergente(s) · ${moneyOrProtected(row.absolute_difference)}`}
                    </small>
                  </span>
                </article>
              ))
            ) : (
              <p>Sem sessões no recorte selecionado.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
