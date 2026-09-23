import { useState } from "react";
import { requireSupabase } from "./lib/supabase";
import { cashMoney, paymentLabels, closingReceipt, type ClosingReport } from "./cash-receivables";

type Movement = { id: string; kind: string; direction: string; payment_method_code: string; amount: number; notes: string; created_at: string };
export default function CashLedger({ sessionId }: { sessionId?: string }) {
  const [open,setOpen]=useState(false);
  const [rows,setRows]=useState<Movement[]>([]);
  const [report,setReport]=useState<ClosingReport|null>(null);
  const [openedAt,setOpenedAt]=useState("");
  const [amount,setAmount]=useState(""); const [description,setDescription]=useState(""); const [method,setMethod]=useState("cash");
  const [operationKey,setOperationKey]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  const load=async()=>{
    if(!sessionId)return;
    const [movements,summary,session]=await Promise.all([
      requireSupabase().from("cash_movements").select("id,kind,direction,payment_method_code,amount,notes,created_at").eq("cash_session_id",sessionId).order("created_at"),
      requireSupabase().rpc("staff_cash_closing_report",{target_session_id:sessionId}),
      requireSupabase().from("cash_sessions").select("opened_at,opening_float").eq("id",sessionId).single(),
    ]);
    if(movements.error||summary.error||session.error)throw new Error(movements.error?.message||summary.error?.message||session.error?.message);
    setRows(movements.data||[]);setReport(summary.data as ClosingReport);setOpenedAt(session.data.opened_at);
  };
  const show=async()=>{setOpen(true);setBusy(true);setMessage("");try{await load();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}};
  const save=async()=>{
    const value=Number(amount.replace(",","."));
    if(!Number.isFinite(value)||value<=0||description.trim().length<3)return setMessage("Informe o valor e a descrição da despesa.");
    if(!sessionId||busy)return;
    setBusy(true);setMessage("");
    try{
      const {error}=await requireSupabase().rpc("staff_record_cash_expense",{requested_operation_key:operationKey,target_session_id:sessionId,requested_payment_method:method,requested_amount:value,requested_description:description.trim()});
      if(error)throw error;
      setAmount("");setDescription("");setOperationKey(crypto.randomUUID());await load();setMessage("Despesa registrada neste caixa.");
    }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  };
  const expected=Number(report?.session.opening_float||0)+rows.filter(row=>row.payment_method_code==="cash").reduce((sum,row)=>sum+(row.direction==="in"?1:-1)*Number(row.amount),0);
  return <><button type="button" disabled={!sessionId} onClick={()=>void show()}>Conferir caixa e despesas</button>{open?<div className="cash-modal-backdrop"><div className="cash-modal"><button className="cash-modal-close" type="button" disabled={busy} onClick={()=>setOpen(false)}>×</button><h3>Conferir caixa e despesas</h3>{openedAt?<p>Caixa aberto em {new Date(openedAt).toLocaleString("pt-BR",{timeZone:"America/Fortaleza"})}</p>:null}{message?<p role="status">{message}</p>:null}<strong>Dinheiro esperado na gaveta: {cashMoney(expected)}</strong><p>Despesas em Pix ou cartão não diminuem o dinheiro físico.</p><h4>Lançar despesa</h4><label>Descrição<input value={description} disabled={busy} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: compra de embalagens" /></label><label>Valor<input inputMode="decimal" value={amount} disabled={busy} onChange={e=>setAmount(e.target.value)} /></label><label>Pago com<select value={method} disabled={busy} onChange={e=>setMethod(e.target.value)}>{Object.entries(paymentLabels).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label><button type="button" disabled={busy} onClick={()=>void save()}>{busy?"Aguarde…":"Registrar despesa"}</button><h4>Movimentações</h4>{rows.map(row=><p key={row.id}>{row.kind==="expense"?"Despesa":row.direction==="in"?"Entrada":"Saída"} · {paymentLabels[row.payment_method_code]||row.payment_method_code} · {cashMoney(row.amount)}<br/>{row.notes}</p>)}{report?<details><summary>Conferir fatias, pagamentos e pendências</summary><pre style={{whiteSpace:"pre-wrap"}}>{closingReceipt(report)}</pre></details>:null}</div></div>:null}</>;
}
