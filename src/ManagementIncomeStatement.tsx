import { calculateManagementResult, classifyCoverage } from "./lib/management-accounting";
import { periodLabel, type ManagementReportV2, type ManagementReportV2Warning } from "./lib/management-reports";
import { money } from "./lib/thermal-format";

export const centsMoney = (value: number | null) => value === null ? "Não classificado" : money(value / 100);
export const resultPercent = (value: number, base: number) => base ? `${(value / base * 100).toFixed(1).replace(".", ",")}%` : "—";
const warningText: Record<ManagementReportV2Warning, string> = {
  partial_cost_coverage: "A cobertura de custos ainda é parcial.",
  estimated_current_costs: "Custo estimado com os valores atuais; não representa um custo histórico registrado.",
  missing_costs: "Sem custo para parte das vendas; sua receita fica fora do lucro calculável.",
  pro_labore_not_classified: "Pró-labore ainda não classificado; o lucro pode estar superestimado.",
  fees_allocated_proportionally: "Taxas distribuídas proporcionalmente entre as vendas.",
  fees_estimated_from_receipts: "Taxas estimadas pelos recebimentos; taxas efetivas indisponíveis.",
  cost_classes_unallocated: "Composição dos custos ainda não classificada; não é possível separar margem de contribuição.",
  losses_estimated_current: "Custo das perdas estimado pelos valores atuais.",
  missing_loss_costs: "Há perdas sem custo; o lucro pode estar superestimado.",
  cash_excludes_unrecorded_site_receipts: "Recebimentos do site sem movimento registrado ficam fora do caixa exibido.",
};

export function resultView(report: ManagementReportV2) {
  const r = report.result;
  const coverage = classifyCoverage(report.coverage);
  const calculated = calculateManagementResult({
    salesRevenueCents: r.salesRevenueCents, feesCents: r.salesRevenueCents - r.netRevenueCents,
    cogsCents: r.cogsCents, lossesCents: r.lossesCents,
    unabsorbedOperatingExpensesCents: r.unabsorbedOperatingExpensesCents,
    // Unknown informational components must remain null in the display, never inferred from cash.
    absorbedFixedCostsCents: r.absorbedFixedCostsCents ?? 0,
    proLaboreCents: r.proLaboreCents, ownerWithdrawalsCents: r.ownerWithdrawalsCents ?? 0, coverage,
  });
  const partial = r.isPartial || coverage.isPartial || report.warnings.length > 0;
  const estimated = coverage.estimated_current.units !== 0 || coverage.estimated_current.revenueCents !== 0
    || report.warnings.some(w => ["estimated_current_costs", "fees_estimated_from_receipts", "losses_estimated_current"].includes(w));
  return { ...calculated, coverage, partial, estimated, qualifier: estimated ? "estimado · parcial" : partial ? "parcial" : "período completo" };
}

export function ManagementConfidence({ report }: { report: ManagementReportV2 }) {
  const view = resultView(report);
  return view.partial ? <aside className="mg-notice mg-result-warning" role="alert">
    <strong>Resultado parcial{view.estimated ? " · estimado" : ""}</strong>
    <p>Valores calculáveis sujeitos à cobertura e à classificação abaixo.</p>
    <ul>{report.warnings.map(w => <li key={w}>{warningText[w] || "Há uma pendência de confiança no relatório."}</li>)}</ul>
    {view.coverage.missing.units || view.coverage.missing.revenueCents ? <p>Sem custo: {view.coverage.missing.units} unidades · {centsMoney(view.coverage.missing.revenueCents)} de receita líquida excluída do lucro.</p> : null}
  </aside> : <p className="mg-sub">Período completo · custos históricos disponíveis.</p>;
}

export type ResultRow = { id: string; label: string; value: number; detail: string; total?: boolean; deduction?: boolean; qualified?: boolean };
export function incomeRows(report: ManagementReportV2): ResultRow[] {
  const v = resultView(report);
  const r = report.result;
  return [
    { id: "sales", label: "Receita de vendas", value: v.salesRevenueCents, detail: "Vendas efetivadas, após descontos, cortesias e reversões comerciais.", total: true },
    { id: "fees", label: r.feesActualCents === null ? "Taxas estimadas" : "Taxas", value: v.salesRevenueCents - v.netRevenueCents, detail: r.feesActualCents === null ? "Taxas efetivas indisponíveis. Estimativa alocada às vendas do período." : "Taxas deduzidas da receita de vendas.", deduction: true },
    { id: "net", label: "Receita líquida", value: v.netRevenueCents, detail: "Receita de vendas menos taxas.", total: true, qualified: r.feesActualCents === null },
    { id: "uncovered", label: "Receita sem custo conhecido", value: v.coverage.missing.revenueCents, detail: "Excluída da base do lucro calculável. Não representa despesa.", deduction: true },
    { id: "covered", label: "Receita coberta por custos", value: v.coveredRevenueCents, detail: "Receita líquida das vendas com custo histórico ou estimado.", total: true },
    { id: "cogs", label: "CMV conhecido", value: v.cogsCents, detail: "Custo dos produtos vendidos com informação disponível, incluindo custos já absorvidos.", deduction: true, qualified: true },
    { id: "gross", label: "Lucro bruto coberto", value: v.coveredGrossProfitCents, detail: "Receita coberta menos CMV conhecido.", total: true, qualified: true },
    { id: "losses", label: "Perdas e descartes", value: r.lossesCents, detail: "Custo disponível das perdas registradas no período.", deduction: true, qualified: true },
    { id: "expenses", label: "Despesas operacionais não absorvidas", value: r.unabsorbedOperatingExpensesCents, detail: "Somente despesas que ainda não estão incluídas no CMV ou nas taxas.", deduction: true },
    { id: "before", label: "Resultado antes do pró-labore", value: v.operatingResultBeforeProLaboreCents, detail: "Lucro bruto coberto menos perdas e despesas não absorvidas.", total: true, qualified: true },
    { id: "prolabore", label: "Pró-labore", value: v.proLaboreCents, detail: report.warnings.includes("pro_labore_not_classified") ? "Pró-labore ainda não classificado. O valor registrado não comprova ausência de remuneração." : "Remuneração dos sócios deduzida uma única vez do resultado.", deduction: true },
    { id: "profit", label: "Lucro após pró-labore", value: v.profitAfterProLaboreCents, detail: "Resultado antes do pró-labore menos a remuneração classificada. Retiradas não são deduzidas novamente.", total: true, qualified: true },
  ];
}

export function ManagementCoverage({ report }: { report: ManagementReportV2 }) {
  const c = classifyCoverage(report.coverage);
  const rows = [["Histórico", c.historical, c.historicalUnitsPercent, c.historicalRevenuePercent], ["Estimado atual", c.estimated_current, c.estimatedUnitsPercent, c.estimatedRevenuePercent], ["Sem custo", c.missing, c.missingUnitsPercent, c.missingRevenuePercent]] as const;
  return <div className="mg-card"><h3>Cobertura de custos</h3><p className="mg-sub">Unidades e receita líquida · estimativas não completam o histórico.</p>
    <div className="mg-result-table-wrap" tabIndex={0} role="region" aria-label="Cobertura de custos detalhada"><table className="mg-table"><caption>Cobertura de custos</caption><thead><tr><th>Origem</th><th className="num">Unidades</th><th className="num">% unidades</th><th className="num">Receita líquida</th><th className="num">% receita</th></tr></thead><tbody>
      {rows.map(([label, bucket, units, revenue]) => <tr key={label}><th scope="row">{label}</th><td className="num">{bucket.units}</td><td className="num">{c.totalUnits ? `${units.toFixed(1).replace(".", ",")}%` : "—"}</td><td className="num">{centsMoney(bucket.revenueCents)}</td><td className="num">{c.totalRevenueCents ? `${revenue.toFixed(1).replace(".", ",")}%` : "—"}</td></tr>)}
    </tbody></table></div>
  </div>;
}

export default function ManagementIncomeStatement({ report }: { report: ManagementReportV2 }) {
  const v = resultView(report);
  return <div className="mg-result-view">
    <ManagementConfidence report={report} />
    <div className="mg-card"><h3>Demonstrativo do resultado</h3><p className="mg-sub">{periodLabel(report)} · competência das vendas · percentuais sobre a receita de vendas</p>
      <div className="mg-result-table-wrap" tabIndex={0} role="region" aria-label="Demonstrativo do resultado"><table className="mg-table mg-dre"><caption>DRE gerencial · {v.qualifier}</caption><thead><tr><th>Composição e origem</th><th className="num">Valor</th><th className="num">% receita</th></tr></thead><tbody>
        {incomeRows(report).map(row => <tr key={row.id} className={row.total ? "total" : row.deduction ? "minus" : undefined}><td><details><summary>{row.deduction ? "(−) " : row.total ? "(=) " : ""}{row.label}{row.qualified && v.partial ? ` · ${v.qualifier}` : ""}</summary><p className="mg-sub">{row.detail}</p></details></td><td className="num">{row.deduction ? "− " : ""}{centsMoney(row.value)}</td><td className="num">{resultPercent(row.value, v.salesRevenueCents)}</td></tr>)}
      </tbody></table></div>
    </div>
    <div className="mg-card"><h3>Informações separadas do resultado</h3><dl className="mg-result-facts"><div><dt>Custos fixos já incluídos no CMV</dt><dd>{centsMoney(report.result.absorbedFixedCostsCents)}</dd></div><div><dt>Retiradas dos sócios</dt><dd>{centsMoney(report.result.ownerWithdrawalsCents)}</dd></div><div><dt>Sangrias do caixa</dt><dd>{centsMoney(report.cash.withdrawalCents)}</dd></div></dl><p className="mg-sub">Custos absorvidos não são deduzidos novamente. Sangrias não comprovam retiradas dos sócios nem pró-labore.</p></div>
    <ManagementCoverage report={report} />
  </div>;
}
