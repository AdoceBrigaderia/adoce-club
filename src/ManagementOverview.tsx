import { useId, useState } from "react";
import type { ManagementReportV2 } from "./lib/management-reports";
import { dateOnly, money } from "./lib/thermal-format";
import { centsMoney, incomeRows, ManagementConfidence, ManagementCoverage, resultView } from "./ManagementIncomeStatement";

type Props = { report: ManagementReportV2 | null; error?: string; loading?: boolean; onRetry?: () => void };
const delta = (current: number, previous: number) => previous === 0 ? "Sem base anterior" : `${current >= previous ? "▲" : "▼"} ${(Math.abs(current - previous) / Math.abs(previous) * 100).toFixed(1).replace(".", ",")}% vs período anterior`;

export default function ManagementOverview({ report, error, loading, onRetry }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const detailId = useId();
  if (loading) return <p className="mg-empty" role="status">Carregando o resultado…</p>;
  if (error) return <div className="mg-notice" role="alert"><p>{error}</p><button className="mg-btn" type="button" onClick={onRetry}>Tentar novamente</button></div>;
  if (!report) return <p className="mg-empty">Sem dados disponíveis.</p>;
  const view = resultView(report);
  const rows = incomeRows(report);
  const previous = report.comparison.result;
  const cards = [
    { id: "sales", label: "Receita de vendas", value: view.salesRevenueCents, nature: "Competência das vendas", previous: previous.salesRevenueCents },
    { id: "net", label: "Receita líquida", value: view.netRevenueCents, nature: report.result.feesActualCents === null ? "Após taxas · estimado" : "Após taxas", previous: previous.netRevenueCents },
    { id: "cogs", label: "CMV conhecido", value: view.cogsCents, nature: view.qualifier, previous: previous.cogsCents },
    { id: "gross", label: "Lucro bruto coberto", value: view.coveredGrossProfitCents, nature: view.qualifier, previous: previous.coveredGrossProfitCents },
    { id: "expenses", label: "Despesas operacionais", value: report.result.unabsorbedOperatingExpensesCents, nature: "Não absorvidas no CMV", previous: previous.unabsorbedOperatingExpensesCents },
    { id: "before", label: "Resultado antes do pró-labore", value: view.operatingResultBeforeProLaboreCents, nature: view.qualifier, previous: previous.operatingResultBeforeProLaboreCents },
    { id: "profit", label: "Lucro após pró-labore", value: view.profitAfterProLaboreCents, nature: view.qualifier, previous: previous.profitAfterProLaboreCents },
    { id: "cash", label: "Recebido no período", value: report.cash.receivedCents, nature: "Caixa · movimentos registrados", previous: null },
    { id: "receivables", label: "A receber", value: report.receivables.totalCents, nature: "Posição atual · fora do recorte", previous: null },
    { id: "difference", label: "Diferença de caixa", value: report.cash.cashDifferenceCents, nature: "Caixa · contado menos esperado", previous: null },
  ];
  const selectedCard = cards.find(c => c.id === selected);
  const selectedRow = rows.find(row => row.id === selected);
  const max = Math.max(1, ...report.daily.map(d => Math.abs(d.revenue)));
  return <div className="mg-result-view">
    <ManagementConfidence report={report} />
    {report.comparison.result.isPartial || report.comparison.coverage.isPartial ? <p className="mg-notice" role="alert">Comparativo anterior parcial: as variações também estão sujeitas à cobertura de custos.</p> : null}
    {!report.kpis.sales_count && !view.salesRevenueCents ? <p className="mg-empty">Sem vendas no período. Despesas e movimentos registrados continuam visíveis.</p> : null}
    <div className="mg-kpis mg-result-kpis">
      {cards.map(card => <button type="button" className="mg-kpi mg-kpi-button" key={card.id} aria-expanded={selected === card.id} aria-controls={detailId} onClick={() => setSelected(selected === card.id ? null : card.id)}>
        <small>{card.label}</small><strong>{centsMoney(card.value)}</strong><span>{card.nature}</span><em className="neutral">{card.previous === null ? "Ver detalhamento" : delta(card.value, card.previous)}</em>
      </button>)}
    </div>
    <section id={detailId} className={selectedCard ? "mg-card mg-result-detail" : undefined} aria-live="polite" aria-label="Detalhamento do indicador">
      {selectedCard ? <><h3>{selectedCard.label}</h3><p><strong>{centsMoney(selectedCard.value)}</strong> · {selectedCard.nature}</p>
        {selectedRow ? <p>{selectedRow.detail}</p> : null}
        {selected === "cash" || selected === "difference" ? <dl className="mg-result-facts"><div><dt>Recebimentos registrados</dt><dd>{centsMoney(report.cash.receivedCents)}</dd></div><div><dt>Despesas pagas</dt><dd>{centsMoney(report.cash.expenseCents)}</dd></div><div><dt>Sangrias</dt><dd>{centsMoney(report.cash.withdrawalCents)}</dd></div><div><dt>Suprimentos</dt><dd>{centsMoney(report.cash.supplyCents)}</dd></div><div><dt>Diferença de caixa</dt><dd>{centsMoney(report.cash.cashDifferenceCents)}</dd></div></dl> : null}
        {selected === "receivables" ? <><p>Posição atual dos valores pendentes, independentemente do período de vendas selecionado.</p>{report.receivables.items.length ? <div className="mg-result-table-wrap"><table className="mg-table"><caption>Valores a receber</caption><thead><tr><th>Cliente / pedido</th><th className="num">Pendente</th></tr></thead><tbody>{report.receivables.items.map(item => <tr key={item.order_number}><td>{item.customer_name} · {item.order_number}</td><td className="num">{money(item.remaining)}</td></tr>)}</tbody></table></div> : <p>Nenhum item pendente disponível.</p>}</> : null}
        <button type="button" className="mg-btn" onClick={() => setSelected(null)}>Fechar detalhamento</button></> : null}
    </section>
    <ManagementCoverage report={report} />
    <div className="mg-card"><h3>Vendas por dia</h3><p className="mg-sub">Competência das vendas · os mesmos valores estão na tabela.</p>
      {report.daily.length ? <><div className="mg-result-chart" aria-hidden="true">{report.daily.map(d => <div key={d.date}><span>{dateOnly(d.date)}</span><div className="mg-track"><div className="mg-fill" style={{ width: `${Math.abs(d.revenue) / max * 100}%` }} /></div><b>{money(d.revenue)}</b></div>)}</div>
      <div className="mg-result-table-wrap" tabIndex={0} role="region" aria-label="Vendas por dia detalhadas"><table className="mg-table"><caption>Vendas por dia</caption><thead><tr><th>Dia</th><th className="num">Vendas</th><th className="num">Receita</th></tr></thead><tbody>{report.daily.map(d => <tr key={d.date}><td>{dateOnly(d.date)}</td><td className="num">{d.count}</td><td className="num">{money(d.revenue)}</td></tr>)}</tbody></table></div></> : <p className="mg-empty">Sem vendas no período.</p>}
    </div>
  </div>;
}
