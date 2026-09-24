import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, Printer, RefreshCw, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { fortalezaDateKey } from "./cash-day-cycle";
import { closingPrintJobs, type FullClosingReport } from "./lib/cash-reports";
import { queuePrint, queuePrints } from "./lib/print-queue";
import { cashNumber, channelLabel, dateOnly, money, plainText, signedMoney, timeOnly } from "./lib/thermal-format";
import { dreValues, managementCsv, periodLabel, reportCatalog, type ManagementReport } from "./lib/management-reports";
import "./operation-management.css";

type Tab = "painel" | "vendas" | "sabores" | "recebimentos" | "caixas" | "despesas" | "resultado" | "relatorios";
const tabs: Array<[Tab, string]> = [
  ["painel", "Painel"], ["vendas", "Vendas"], ["sabores", "Sabores e estoque"], ["recebimentos", "Recebimentos"],
  ["caixas", "Caixas"], ["despesas", "Despesas e a receber"], ["resultado", "Resultado (DRE)"], ["relatorios", "Relatórios"],
];
type Preset = "today" | "yesterday" | "7d" | "month" | "custom";

const n = (value: unknown) => Number(value || 0);
const addDays = (key: string, days: number) => {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const rangeFor = (preset: Preset, custom: { start: string; end: string }) => {
  const today = fortalezaDateKey(new Date());
  if (preset === "today") return { start: today, end: today };
  if (preset === "yesterday") return { start: addDays(today, -1), end: addDays(today, -1) };
  if (preset === "7d") return { start: addDays(today, -6), end: today };
  if (preset === "month") return { start: `${today.slice(0, 8)}01`, end: today };
  return custom;
};
const variation = (current: number, previous: number) => {
  if (!previous) return { text: "sem base anterior", className: "neutral" };
  const value = ((current - previous) / previous) * 100;
  return { text: `${value >= 0 ? "▲" : "▼"} ${Math.abs(value).toFixed(1).replace(".", ",")}% vs período anterior`, className: value >= 0 ? "up" : "down" };
};

function VBars({ data, label, format }: { data: Array<{ key: string; value: number; soft?: boolean }>; label: string; format: (value: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="mg-vbars" role="img" aria-label={label} style={{ gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))` }}>
      {data.map((d) => (
        <div key={d.key} className={`mg-bar${d.soft ? " soft" : ""}`} style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} title={`${d.key}: ${format(d.value)}`}>
          <span>{d.key}</span>
        </div>
      ))}
    </div>
  );
}

function HBars({ rows }: { rows: Array<{ name: string; value: number; label: string; sub?: string }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="mg-empty">Sem dados no período.</p>;
  return (
    <div className="mg-hbars">
      {rows.map((r) => (
        <div className="mg-hrow" key={r.name} title={`${r.name}: ${r.label}${r.sub ? ` · ${r.sub}` : ""}`}>
          <span className="mg-name">{r.name}</span>
          <div className="mg-track"><div className="mg-fill" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          <span className="mg-val">{r.label}{r.sub ? <small>{r.sub}</small> : null}</span>
        </div>
      ))}
    </div>
  );
}

export default function OperationManagement() {
  const [tab, setTab] = useState<Tab>("painel");
  const [preset, setPreset] = useState<Preset>("today");
  const [custom, setCustom] = useState(() => { const today = fortalezaDateKey(new Date()); return { start: `${today.slice(0, 8)}01`, end: today }; });
  const [report, setReport] = useState<ManagementReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{ title: string; lines: string[] } | null>(null);
  const range = useMemo(() => rangeFor(preset, custom), [preset, custom]);

  const load = useCallback(async () => {
    setBusy(true); setNotice("");
    const { data, error } = await requireSupabase().rpc("manager_management_report", { start_date: range.start, end_date: range.end });
    setBusy(false);
    if (error) { setNotice(error.message); return; }
    setReport(data as ManagementReport);
  }, [range.end, range.start]);
  useEffect(() => { void load(); }, [load]);

  const print = async (title: string, lines: string[]) => {
    try { await queuePrint(title, lines); setNotice(`"${title}" enviado para a impressora do tablet.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível enviar para a impressora."); }
  };
  const reprintSession = async (sessionId: string) => {
    try {
      const stored = await requireSupabase().from("cash_closing_reports").select("report").eq("session_id", sessionId).maybeSingle();
      let full = stored.data?.report as FullClosingReport | undefined;
      if (!full?.summary) {
        const fresh = await requireSupabase().rpc("staff_cash_closing_report", { target_session_id: sessionId });
        if (fresh.error) throw fresh.error;
        full = fresh.data as FullClosingReport;
      }
      await queuePrints(closingPrintJobs(full));
      setNotice("Fechamento e relatório de sabores enviados para a impressora do tablet.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível reimprimir.");
    }
  };
  const exportCsv = () => {
    if (!report) return;
    const blob = new Blob([managementCsv(report)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `adoce-gestao-${report.period.start}-a-${report.period.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const k = report?.kpis;
  const ticket = k && k.sales_count ? n(k.revenue) / k.sales_count : 0;
  const revenueVar = k ? variation(n(k.revenue), n(k.previous_revenue)) : null;
  const salesVar = k ? variation(n(k.sales_count), n(k.previous_sales_count)) : null;
  const paymentTotal = report?.payments.reduce((sum, p) => sum + n(p.amount), 0) || 0;
  const dre = report ? dreValues(report) : null;
  const dailyData = (report?.daily || []).map((d) => ({ key: report && report.daily.length > 16 ? d.date.slice(8, 10) : dateOnly(d.date).slice(0, 5), value: n(d.revenue), soft: new Date(`${d.date}T12:00:00`).getDay() === 0 }));
  const hourlyData = (report?.hourly || []).filter((h) => h.hour >= 7 && h.hour <= 23).map((h) => ({ key: `${h.hour}h`, value: n(h.count) }));
  const peak = [...(report?.hourly || [])].sort((a, b) => b.count - a.count)[0];

  return (
    <section className="operation-management">
      <div className="operation-title">
        <div>
          <span>Gestão contábil</span>
          <h1>{tabs.find(([id]) => id === tab)?.[1] === "Painel" ? "Painel de vendas" : tabs.find(([id]) => id === tab)?.[1]}</h1>
          <p>{report ? `${periodLabel(report)} · comparado com ${dateOnly(report.period.previous_start)} a ${dateOnly(report.period.previous_end)}` : "Carregando…"}</p>
        </div>
        <div className="mg-head-actions">
          <button type="button" className="mg-btn" onClick={exportCsv} disabled={!report}><Download /> CSV para o contador</button>
          <button type="button" className="mg-btn primary" onClick={() => report && void print("Resumo de vendas", reportCatalog[0].build(report))} disabled={!report}><Printer /> Imprimir resumo</button>
        </div>
      </div>

      <nav className="mg-tabs" aria-label="Áreas da gestão">
        {tabs.map(([id, label]) => <button key={id} type="button" className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>{label}</button>)}
      </nav>

      <div className="mg-filters" role="group" aria-label="Período">
        <div className="mg-seg">
          {([["today", "Hoje"], ["yesterday", "Ontem"], ["7d", "7 dias"], ["month", "Mês"], ["custom", "Período"]] as Array<[Preset, string]>).map(([id, label]) => (
            <button key={id} type="button" className={preset === id ? "on" : ""} aria-pressed={preset === id} onClick={() => setPreset(id)}>{label}</button>
          ))}
        </div>
        {preset === "custom" ? (
          <>
            <label className="mg-date">De<input type="date" value={custom.start} max={custom.end} onChange={(event) => setCustom((c) => ({ ...c, start: event.target.value }))} /></label>
            <label className="mg-date">Até<input type="date" value={custom.end} min={custom.start} onChange={(event) => setCustom((c) => ({ ...c, end: event.target.value }))} /></label>
          </>
        ) : null}
        <button type="button" className="mg-btn" onClick={() => void load()} disabled={busy}><RefreshCw /> {busy ? "Atualizando…" : "Atualizar"}</button>
      </div>
      {notice ? <p className="mg-notice" role="status">{notice}</p> : null}

      {!report ? <p className="mg-empty">{busy ? "Carregando os números…" : "Sem dados."}</p> : (
        <>
          {tab === "painel" ? (
            <>
              <div className="mg-kpis">
                <div className="mg-kpi"><small>Faturamento</small><strong>{money(k!.revenue)}</strong><em className={revenueVar!.className}>{revenueVar!.text}</em></div>
                <div className="mg-kpi"><small>Líquido após taxas</small><strong>{money(n(k!.revenue) - n(k!.fees))}</strong><em className="neutral">taxas {money(k!.fees)}</em></div>
                <div className="mg-kpi"><small>Vendas · ticket médio</small><strong>{k!.sales_count} · {money(ticket)}</strong><em className={salesVar!.className}>{salesVar!.text}</em></div>
                <div className="mg-kpi"><small>Fatias vendidas</small><strong>{k!.slices_sold}</strong><em className="neutral">{k!.rewards_count} cortesias do Clube</em></div>
                <div className="mg-kpi"><small>Perdas</small><strong>{k!.losses}</strong><em className="neutral">fatias descartadas</em></div>
                <div className="mg-kpi"><small>Diferença de caixa</small><strong className={n(k!.cash_difference) < 0 ? "down" : ""}>{signedMoney(n(k!.cash_difference))}</strong><em className="neutral">a receber {money(k!.deferred_open)}</em></div>
              </div>
              <div className="mg-grid-2">
                <div className="mg-card"><h3>Faturamento por dia</h3><p className="mg-sub">Recebido no período</p><VBars data={dailyData} label="Faturamento por dia" format={money} /></div>
                <div className="mg-card"><h3>Recebimentos por forma</h3><p className="mg-sub">Bruto e participação</p>
                  <HBars rows={report.payments.map((p) => ({ name: p.label, value: n(p.amount), label: money(p.amount), sub: paymentTotal ? `${((n(p.amount) / paymentTotal) * 100).toFixed(1).replace(".", ",")}% · taxa ${money(p.fee)}` : undefined }))} />
                </div>
              </div>
              <div className="mg-grid-2">
                <div className="mg-card"><h3>Sabores mais vendidos</h3><p className="mg-sub">Fatias vendidas, do maior para o menor</p>
                  <HBars rows={report.flavors.slice(0, 10).map((f) => ({ name: f.name, value: n(f.sold), label: String(f.sold), sub: money(f.revenue) }))} />
                </div>
                <div className="mg-card"><h3>Vendas por horário</h3><p className="mg-sub">{peak && peak.count ? `Pico às ${peak.hour}h (${peak.count} vendas)` : "Número de vendas por hora"}</p><VBars data={hourlyData} label="Vendas por horário" format={(v) => `${v} vendas`} /></div>
              </div>
              <SessionsTable report={report} onReprint={reprintSession} />
            </>
          ) : null}

          {tab === "vendas" ? (
            <>
              <div className="mg-card"><h3>Faturamento por dia</h3><p className="mg-sub">{periodLabel(report)}</p><VBars data={dailyData} label="Faturamento por dia" format={money} />
                <table className="mg-table"><thead><tr><th>Dia</th><th className="num">Vendas</th><th className="num">Faturamento</th><th className="num">Ticket médio</th></tr></thead>
                  <tbody>{report.daily.map((d) => <tr key={d.date}><td>{dateOnly(d.date)}</td><td className="num">{d.count}</td><td className="num">{money(d.revenue)}</td><td className="num">{money(d.count ? n(d.revenue) / d.count : 0)}</td></tr>)}</tbody></table>
              </div>
              <div className="mg-grid-2">
                <div className="mg-card"><h3>Vendas por horário</h3><VBars data={hourlyData} label="Vendas por horário" format={(v) => `${v} vendas`} /></div>
                <div className="mg-card"><h3>Vendas por canal</h3><HBars rows={report.channels.map((c) => ({ name: channelLabel(c.channel), value: n(c.revenue), label: money(c.revenue), sub: `${c.count} vendas` }))} /></div>
              </div>
            </>
          ) : null}

          {tab === "sabores" ? (
            <div className="mg-card"><h3>Vendas por sabor</h3><p className="mg-sub">Do mais vendido para o menos vendido · custo e margem aparecem quando o custo do sabor estiver cadastrado em Produtos</p>
              <table className="mg-table"><thead><tr><th>Sabor</th><th className="num">Fatias</th><th className="num">Cortesias</th><th className="num">Receita</th><th className="num">Custo</th><th className="num">Margem</th></tr></thead>
                <tbody>{report.flavors.map((f) => { const margin = f.cost == null ? null : n(f.revenue) - n(f.cost); return <tr key={f.name}><td>{f.name}</td><td className="num">{f.sold}</td><td className="num">{n(f.rewards)}</td><td className="num">{money(f.revenue)}</td><td className="num">{f.cost == null ? "—" : money(f.cost)}</td><td className="num">{margin == null ? "—" : money(margin)}</td></tr>; })}</tbody></table>
              {report.losses.length ? <><h3 className="mg-subtitle">Perdas no período</h3><table className="mg-table"><tbody>{report.losses.map((l) => <tr key={l.name}><td>{l.name}</td><td className="num">{l.quantity} fatias</td><td className="num">{l.cost == null ? "—" : money(l.cost)}</td></tr>)}</tbody></table></> : null}
            </div>
          ) : null}

          {tab === "recebimentos" ? (
            <div className="mg-card"><h3>Recebimentos por forma</h3>
              <HBars rows={report.payments.map((p) => ({ name: p.label, value: n(p.amount), label: money(p.amount) }))} />
              <table className="mg-table"><thead><tr><th>Forma</th><th className="num">Bruto</th><th className="num">Participação</th><th className="num">Taxa</th><th className="num">Líquido</th></tr></thead>
                <tbody>{report.payments.map((p) => <tr key={p.method}><td>{p.label}</td><td className="num">{money(p.amount)}</td><td className="num">{paymentTotal ? `${((n(p.amount) / paymentTotal) * 100).toFixed(1).replace(".", ",")}%` : "—"}</td><td className="num">{money(p.fee)}</td><td className="num">{money(n(p.amount) - n(p.fee))}</td></tr>)}
                  <tr className="total"><td>Total</td><td className="num">{money(paymentTotal)}</td><td /><td className="num">{money(report.payments.reduce((s, p) => s + n(p.fee), 0))}</td><td className="num">{money(paymentTotal - report.payments.reduce((s, p) => s + n(p.fee), 0))}</td></tr></tbody></table>
            </div>
          ) : null}

          {tab === "caixas" ? <SessionsTable report={report} onReprint={reprintSession} full /> : null}

          {tab === "despesas" ? (
            <div className="mg-grid-2">
              <div className="mg-card"><h3>Despesas, sangrias e suprimentos</h3>
                {report.expenses.length ? <table className="mg-table"><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th className="num">Valor</th></tr></thead>
                  <tbody>{report.expenses.map((e, index) => <tr key={`${e.date}-${index}`}><td>{dateOnly(e.date)} {timeOnly(e.date)}</td><td>{({ expense: "Despesa", withdrawal: "Sangria", supply: "Suprimento" } as Record<string, string>)[e.kind] || e.kind}</td><td>{e.notes}</td><td className="num">{money(e.amount)}</td></tr>)}</tbody></table> : <p className="mg-empty">Nenhum lançamento no período.</p>}
              </div>
              <div className="mg-card"><h3>A receber (fiado)</h3><p className="mg-sub">Posição atual</p>
                {report.receivables.length ? <table className="mg-table"><thead><tr><th>Cliente</th><th>Pedido</th><th className="num">Dias</th><th className="num">Valor</th></tr></thead>
                  <tbody>{report.receivables.map((r) => <tr key={r.order_number}><td>{r.customer_name}</td><td>{r.order_number}</td><td className="num">{r.days > 7 ? <span className="mg-badge bad">{r.days}</span> : r.days}</td><td className="num">{money(r.remaining)}</td></tr>)}</tbody></table> : <p className="mg-empty">Nada a receber.</p>}
              </div>
            </div>
          ) : null}

          {tab === "resultado" && dre ? (
            <div className="mg-grid-2">
              <div className="mg-card"><h3>Demonstrativo do resultado</h3><p className="mg-sub">{periodLabel(report)}</p>
                <table className="mg-table mg-dre"><tbody>
                  <tr><td>Vendas pelo preço de tabela</td><td className="num">{money(report.dre.table_value)}</td></tr>
                  <tr className="minus"><td>(−) Descontos concedidos</td><td className="num">− {money(report.dre.discounts)}</td></tr>
                  <tr className="minus"><td>(−) Cortesias do Clube</td><td className="num">− {money(report.dre.rewards_value)}</td></tr>
                  <tr className="total"><td>= Receita de vendas</td><td className="num">{money(dre.revenue)}</td></tr>
                  <tr className="minus"><td>(−) Taxas de Pix e cartões</td><td className="num">− {money(report.dre.fees)}</td></tr>
                  <tr className="total"><td>= Receita líquida</td><td className="num">{money(dre.net)}</td></tr>
                  <tr className="minus"><td>(−) Custo das fatias vendidas</td><td className="num">− {money(report.dre.cogs)}</td></tr>
                  <tr className="minus"><td>(−) Perdas e descartes (custo)</td><td className="num">− {money(report.dre.losses_cost)}</td></tr>
                  <tr className="minus"><td>(−) Despesas lançadas no caixa</td><td className="num">− {money(report.dre.expenses)}</td></tr>
                  <tr className="total"><td>= Resultado</td><td className={`num ${dre.result < 0 ? "down" : ""}`}>{signedMoney(dre.result)}</td></tr>
                </tbody></table>
                <p className="mg-sub">Custo cadastrado para {report.dre.cogs_coverage}% das fatias vendidas. Cadastre o custo de cada sabor em Produtos para o resultado ficar completo.</p>
              </div>
              <div className="mg-card"><h3>Ajustes na receita</h3>
                <table className="mg-table"><tbody>
                  <tr><td>Descontos concedidos</td><td className="num">{money(report.adjustments.discounts)}</td></tr>
                  <tr><td>Cortesias do Clube</td><td className="num">{money(report.adjustments.rewards_value)}</td></tr>
                  <tr><td>Cancelamentos ({report.adjustments.cancelled_count})</td><td className="num">{money(report.adjustments.cancelled_value)}</td></tr>
                </tbody></table>
              </div>
            </div>
          ) : null}

          {tab === "relatorios" ? (
            <div className="mg-reports">
              {reportCatalog.map((item) => (
                <div className="mg-report" key={item.id}>
                  <h4>{item.name}</h4>
                  <p>{item.description}</p>
                  <div>
                    <button type="button" className="mg-btn" onClick={() => setPreview({ title: item.name, lines: item.build(report) })}><Eye /> Ver na tela</button>
                    <button type="button" className="mg-btn primary" onClick={() => void print(item.name, item.build(report))}><Printer /> Imprimir</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}

      {preview ? (
        <div className="mg-preview-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
          <div className="mg-preview" role="dialog" aria-modal="true" aria-label={preview.title}>
            <button type="button" className="mg-close" onClick={() => setPreview(null)} aria-label="Fechar"><X /></button>
            <h3>{preview.title}</h3>
            <pre className="mg-receipt">{plainText(preview.lines)}</pre>
            <button type="button" className="mg-btn primary" onClick={() => void print(preview.title, preview.lines)}><Printer /> Imprimir (58 mm)</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SessionsTable({ report, onReprint, full = false }: { report: ManagementReport; onReprint: (id: string) => void; full?: boolean }) {
  return (
    <div className="mg-card">
      <h3>Caixas do período</h3><p className="mg-sub">Cada caixa tem número único e sequencial</p>
      {report.sessions.length ? (
        <div className="mg-table-wrap">
          <table className="mg-table">
            <thead><tr><th>Caixa</th><th>Aberto</th><th>Fechado</th><th className="num">Vendas</th><th className="num">Receita</th>{full ? <><th className="num">Fatias</th><th className="num">Perdas</th></> : null}<th className="num">Esperado</th><th className="num">Contado</th><th className="num">Diferença</th><th /></tr></thead>
            <tbody>{report.sessions.map((s) => {
              const diff = n(s.drawer.difference);
              return (
                <tr key={s.id}>
                  <td><b>{cashNumber(s.number)}</b></td>
                  <td>{dateOnly(s.opened_at)} {timeOnly(s.opened_at)} · {s.opened_by_name}</td>
                  <td>{s.closed_at ? `${timeOnly(s.closed_at)} · ${s.closed_by_name || ""}` : <span className="mg-badge warn">aberto</span>}</td>
                  <td className="num">{s.sales_count}</td>
                  <td className="num">{money(s.revenue)}</td>
                  {full ? <><td className="num">{s.slices_sold}</td><td className="num">{s.losses}</td></> : null}
                  <td className="num">{money(s.drawer.expected)}</td>
                  <td className="num">{s.drawer.counted == null ? "—" : money(s.drawer.counted)}</td>
                  <td className="num">{s.status !== "closed" ? "—" : <span className={`mg-badge ${diff === 0 ? "good" : "bad"}`}>{diff === 0 ? "OK" : signedMoney(diff)}</span>}</td>
                  <td>{s.status === "closed" ? <button type="button" className="mg-link" onClick={() => onReprint(s.id)}><Printer /> Reimprimir</button> : null}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : <p className="mg-empty">Nenhum caixa no período.</p>}
    </div>
  );
}
