import CashPagedText from "./CashPagedText";
import CashLedger from "./CashLedger";
import { useState } from "react";
import { requireSupabase } from "./lib/supabase";
import { cashMoney, paymentLabels, type ClosingReport } from "./cash-receivables";
import { closingPrintJobs, type FullClosingReport } from "./lib/cash-reports";
import { queuePrints } from "./lib/print-queue";
import { plainText } from "./lib/thermal-format";

type Pending = { id: string; customer_name: string; order_number: string; total: number; amount_paid: number };
export default function CashSessionActions({ sessionId, storeId, hasDraft, onChanged }: { sessionId?: string; storeId?: string; hasDraft: boolean; onChanged: () => void }) {
  const [view, setView] = useState<"close" | "pending" | null>(null);
  const [rows, setRows] = useState<Pending[]>([]);
  const [selected, setSelected] = useState<Pending | null>(null);
  const [method, setMethod] = useState("pix");
  const [counted, setCounted] = useState("");
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<ClosingReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [page,setPage] = useState(0);
  const loadPending = async () => {
    setBusy(true); setMessage(""); setView("pending");setSelected(null);setPage(0);
    try {
      if (!storeId) throw new Error("Selecione a loja.");
      const { data, error } = await requireSupabase().from("instant_orders").select("id,customer_name,order_number,total,amount_paid").eq("store_id", storeId).eq("payment_deferred", true).eq("payment_status", "pending").order("created_at");
      if (error) throw error;
      setRows(data || []);
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  };
  const receive = async () => {
    if (!selected || !sessionId) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await requireSupabase().rpc("staff_receive_deferred_cash_sale", { target_order_id: selected.id, target_session_id: sessionId, requested_method: method });
      if (error) throw error;
      setSelected(null); await loadPending(); setMessage("Pagamento recebido e registrado no caixa atual."); onChanged();
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  };
  const closeCash = async () => {
    const value = Number(counted.replace(",", "."));
    if (!counted.trim() || !Number.isFinite(value) || value < 0) return setMessage("Informe o dinheiro contado na gaveta.");
    if (!sessionId || hasDraft) return setMessage("Conclua ou cancele o pedido aberto antes de fechar o caixa.");
    setBusy(true); setMessage("");
    try {
      const { data, error } = await requireSupabase().rpc("staff_close_cash_with_report", { target_session_id: sessionId, next_counted_cash: value });
      if (error) throw error;
      setReport(data as ClosingReport);
      try { await queuePrints(closingPrintJobs(data as FullClosingReport)); setMessage("Caixa fechado. Fechamento e relatório de sabores enviados para a impressora."); }
      catch { setMessage("Caixa fechado, mas os cupons não entraram na fila de impressão. Reimprima pela aba Gestão."); }
      window.dispatchEvent(new Event("adoce-cash-changed"));
      onChanged();
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  };
  const size = 3;
  return <><div className="cash-session-actions"><CashLedger sessionId={sessionId} /><button type="button" onClick={() => void loadPending()}>Pagamentos pendentes</button><button type="button" disabled={!sessionId || busy} onClick={() => { setView("close"); setReport(null); setMessage(""); }}>Fechar caixa</button></div>{view ? <div className="cash-modal-backdrop cash-fast-backdrop"><div className="cash-modal cash-fast-modal" role="dialog" aria-modal="true" aria-labelledby="cash-session-title">
    <header className="cash-fast-heading"><h3 id="cash-session-title">{view === "pending" ? selected ? "Receber pagamento" : "Pagamentos pendentes" : "Fechar caixa"}</h3><button type="button" className="cash-modal-close" disabled={busy} onClick={() => { setView(null); setSelected(null); }} aria-label="Fechar janela do caixa">×</button></header>
    {message ? <p role="status" className="cash-fast-message">{message}</p> : null}
    {view === "pending" ? <>{!sessionId ? <p>Abra o caixa para registrar um recebimento.</p> : null}{!busy && !rows.length ? <p>Nenhum pagamento pendente.</p> : null}
      {selected ? <div className="cash-fast-body"><h4>{selected.customer_name}</h4><strong>{selected.order_number} · {cashMoney(selected.total - selected.amount_paid)}</strong><label>Meio de pagamento<select value={method} onChange={event => setMethod(event.target.value)}>{Object.entries(paymentLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label><button type="button" disabled={busy || !sessionId} onClick={() => void receive()}>Confirmar recebimento</button><button type="button" disabled={busy} onClick={()=>setSelected(null)}>Voltar à lista</button></div> : <><div className="cash-compact-list">{rows.slice(page*size,page*size+size).map(row=><button type="button" key={row.id} disabled={busy} onClick={()=>{setSelected(row);setMessage("");}}><span>{row.customer_name} · {row.order_number}</span><strong>{cashMoney(row.total-row.amount_paid)}</strong></button>)}</div><div className="cash-fast-footer cash-reprint-pages"><button type="button" disabled={busy || page===0} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>{page+1} / {Math.max(1,Math.ceil(rows.length/size))}</span><button type="button" disabled={busy || (page+1)*size>=rows.length} onClick={()=>setPage(value=>value+1)}>Próxima</button></div></>}
    </> : report ? <CashPagedText text={closingPrintJobs(report as FullClosingReport).map((job) => plainText(job.lines)).join(String.fromCharCode(10, 10))} /> : <div className="cash-fast-body"><p className="cash-fast-hint">Informe somente o dinheiro físico da gaveta. Pix e cartões aparecem separadamente no relatório.</p><label>Dinheiro contado<input inputMode="decimal" value={counted} onChange={event => setCounted(event.target.value)} /></label><button type="button" disabled={busy || hasDraft} onClick={() => void closeCash()}>{busy ? "Fechando…" : "Fechar e imprimir relatório"}</button>{hasDraft ? <p>Conclua ou cancele o pedido iniciado antes de fechar.</p> : null}</div>}
  </div></div> : null}</>;
}
