import { useMemo } from "react";
import {
  BadgeDollarSign,
  MonitorSmartphone,
  Store,
  UserRound,
} from "lucide-react";
import {
  channelLabel,
  normalizeOperationalReportBreakdowns,
  type NullableNumber,
  type OperationalReportBreakdownPayload,
} from "./operational-report-breakdowns";

type Props = {
  report: OperationalReportBreakdownPayload;
};

const money = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const number = (value: number) => Number(value || 0).toLocaleString("pt-BR");
const moneyOrProtected = (value: NullableNumber) =>
  value === null ? "Protegido por permissão" : money(value);

export default function OperationReportBreakdowns({ report }: Props) {
  const breakdowns = useMemo(
    () => normalizeOperationalReportBreakdowns(report),
    [report],
  );

  return (
    <section
      className="operation-report-breakdowns"
      aria-label="Detalhamentos operacionais"
      data-touch-budget="0"
    >
      <header className="operation-report-breakdowns-heading">
        <div>
          <small>Leitura imediata, sem abrir novas telas</small>
          <h3>Detalhamento da operação</h3>
          <p>Canal, operador, caixa e sessões aparecem no mesmo painel.</p>
        </div>
      </header>

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
              <p>Sem vendas por canal no período.</p>
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
              <p>Sem vendas vinculadas a caixa no período.</p>
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
              <p>Sem vendas presenciais por operador no período.</p>
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
              <p>Sem sessões de caixa no período.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
