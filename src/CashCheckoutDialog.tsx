import { useEffect, useRef, useState } from "react";
import { X, Banknote, CreditCard } from "lucide-react";
import { addSplitPayment, paymentBalance, parseCashAmount, singlePayment, type CashCheckoutRequest, type CashPaymentMethod } from "./cash-fast-checkout";
import { paymentLabels, splitChange, validateDeferredSale } from "./cash-receivables";
import type { Payment } from "./cash-register-domain";
import "./cash-fast-checkout.css";

const money = (value: number) => value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const methodCodes: CashPaymentMethod[] = ["cash","pix","credit_card","debit_card","payroll"];
type Step = "choose" | "cash" | "split" | "special" | "change" | "pix";
export default function CashCheckoutDialog({total, loyaltyCharge, methods, pixKey, busy, notice, printReceipt, onPrintChange, onClose, onComplete}: {
  total:number; loyaltyCharge:number; methods:Array<{code:string;label:string}>; pixKey:string; busy:boolean; notice:string;
  printReceipt:boolean; onPrintChange:(checked:boolean)=>void; onClose:()=>void; onComplete:(request:CashCheckoutRequest)=>Promise<void>;
}) {
  const [step,setStep] = useState<Step>("choose");
  const [method,setMethod] = useState<CashPaymentMethod>("cash");
  const [received,setReceived] = useState(String(total).replace(".",","));
  const [payments,setPayments] = useState<Payment[]>([]);
  const [amount,setAmount] = useState("");
  const [error,setError] = useState("");
  const [name,setName] = useState("");
  const [pix,setPix] = useState("0"); const [source,setSource] = useState("Conta pessoal");
  const [changePayments,setChangePayments] = useState<Payment[]>([]); const [changeReturn,setChangeReturn] = useState<Step>("cash");
  const [splitPixChange,setSplitPixChange] = useState(false);
  const locked = useRef(false);
  const available = methodCodes.filter(code => methods.some(item => item.code === code));
  const balance = paymentBalance(total,payments);
  const cashPaid = parseCashAmount(received);
  const cashChange = Number.isFinite(cashPaid) ? Math.max(0,cashPaid-total) : 0;
  useEffect(() => {
    const escape = (event:KeyboardEvent) => {if(event.key === "Escape" && !busy && !locked.current) onClose();};
    window.addEventListener("keydown",escape); return () => window.removeEventListener("keydown",escape);
  },[busy,onClose]);
  const complete = async (next:Payment[], selected:CashPaymentMethod, extra:Partial<CashCheckoutRequest> = {}) => {
    if(busy || locked.current) return;
    locked.current = true; setError("");
    try { await onComplete({method:selected,payments:next,...extra}); }
    catch (cause) {setError(cause instanceof Error ? cause.message : "Não foi possível finalizar. Tente novamente.");}
    finally {locked.current = false;}
  };
  const choose = (selected:CashPaymentMethod) => {
    setError("");setMethod(selected);
    if(selected === "cash") setStep("cash");
    else void complete(singlePayment(total,selected),selected);
  };
  const finishCash = () => {
    try {void complete(singlePayment(total,"cash",received),"cash");}
    catch(cause) {setError((cause as Error).message);}
  };
  const add = () => {
    // Depois de uma falha, reenvia a mesma divisão sem acrescentar outro pagamento.
    if(balance.remaining === 0 && payments.length) {void complete(payments,method);return;}
    try {
      const next = addSplitPayment(total,payments,method,amount);
      const nextBalance = paymentBalance(total,next);
      if(nextBalance.remaining === 0 && new Set(next.map(item=>item.method)).size < 2)
        throw Error("Escolha duas formas diferentes ou volte ao pagamento único.");
      setError("");
      if(nextBalance.remaining === 0 && nextBalance.change > 0 && splitPixChange) {openChange(next,"split");return;}
      setPayments(next);setAmount("");
      if(nextBalance.remaining === 0) void complete(next,method);
    } catch(cause) {setError((cause as Error).message);}
  };
  const openChange = (next:Payment[], previous:Step) => {setChangePayments(next);setChangeReturn(previous);setStep("change");setError("");};
  const back = () => {setError("");setStep("choose");setPayments([]);setAmount("");};
  const title = step === "choose" ? "Como será o pagamento?" : step === "cash" ? "Pagamento em dinheiro" : step === "split" ? "Duas ou mais formas" : step === "change" ? "Troco por Pix" : step === "pix" ? "Chave Pix" : "Pagamento pendente";
  return <div className="cash-modal-backdrop cash-fast-backdrop"><div className="cash-modal cash-fast-modal" role="dialog" aria-modal="true" aria-labelledby="cash-payment-title" aria-busy={busy}>
    <header className="cash-fast-heading"><div><h3 id="cash-payment-title">{title}</h3><p>Total <strong>{money(total)}</strong></p></div><button type="button" className="cash-modal-close" disabled={busy} onClick={onClose} aria-label="Fechar pagamento"><X /></button></header>
    <div className="cash-fast-body">
      {step === "choose" ? <>
        <label className="cash-print-choice"><input type="checkbox" checked={printReceipt} disabled={busy} onChange={event=>onPrintChange(event.target.checked)} /> Imprimir cupom</label>
        <div className="cash-fast-methods">{available.map(code=><button type="button" key={code} disabled={busy} onClick={()=>choose(code)}>{code === "cash" || code === "payroll" ? <Banknote /> : <CreditCard />}<span>{paymentLabels[code]}</span></button>)}</div>
        {!available.length ? <p role="alert">Nenhuma forma de pagamento ativa. Confira as configurações do caixa.</p> : null}
        <button type="button" className="cash-fast-wide" disabled={busy || available.length < 2} onClick={()=>{setMethod(available[0] || "cash");setStep("split");}}>Pagar com duas ou mais formas</button>
        <div className="cash-fast-extras"><button type="button" disabled={busy} onClick={()=>{setMethod(available[0] || "cash");setStep("special");}}>Pagamento pendente</button><button type="button" disabled={busy} onClick={()=>setStep("pix")}>Chave Pix</button></div>
        <small className="cash-fast-hint">Pix e cartões: toque após conferir o recebimento.</small>
      </> : null}
      {step === "cash" ? <>
        <label>Valor recebido<input inputMode="decimal" value={received} disabled={busy} onChange={event=>{setReceived(event.target.value);setError("");}} onFocus={event=>event.target.select()} /></label>
        <div className="cash-fast-balance">Troco <strong>{money(cashChange)}</strong></div>
        {cashChange > 0 ? <button type="button" disabled={busy} onClick={()=>{try{openChange(singlePayment(total,"cash",received),"cash");}catch(cause){setError((cause as Error).message);}}}>Devolver parte do troco por Pix</button> : null}
        <p className="cash-fast-hint">Com o valor exato, basta finalizar. Para troco, altere o valor recebido.</p>
      </> : null}
      {step === "split" ? <>
        <div className="cash-fast-split-fields"><label>Forma<select aria-label="Forma" value={method} disabled={busy || balance.remaining === 0} onChange={event=>{setMethod(event.target.value as CashPaymentMethod);setError("");}}>{available.map(code=><option key={code} value={code}>{paymentLabels[code]}</option>)}</select></label><label>Valor deste pagamento<input inputMode="decimal" value={amount} disabled={busy || balance.remaining === 0} onChange={event=>setAmount(event.target.value)} placeholder="Digite o valor" /></label></div>
        <div className="cash-fast-allocations">{available.filter(code=>payments.some(item=>item.method===code)).map(code=><div key={code}><span>{paymentLabels[code]}</span><strong>{money(payments.filter(item=>item.method===code).reduce((sum,item)=>sum+item.amount,0))}</strong></div>)}</div>
        <div className="cash-fast-balance">Restante <strong>{money(balance.remaining)}</strong></div>
        <small className="cash-fast-hint">A venda finaliza ao adicionar o pagamento que cobre o restante.</small>
        {method === "cash" && parseCashAmount(amount) > balance.remaining ? <><div className="cash-fast-balance">Troco previsto <strong>{money(parseCashAmount(amount)-balance.remaining)}</strong></div><label className="cash-print-choice"><input type="checkbox" checked={splitPixChange} onChange={event=>setSplitPixChange(event.target.checked)} /> Devolver troco por Pix</label></> : null}
        {payments.length ? <button type="button" disabled={busy} onClick={()=>{setPayments([]);setError("");}}>Limpar pagamentos</button> : null}
      </> : null}
      {step === "special" ? <>
        <label>Nome do cliente<input autoComplete="name" value={name} onChange={event=>setName(event.target.value)} /></label>
        <p className="cash-fast-hint">Baixa o estoque e deixa o valor a receber.</p>
      </> : null}
      {step === "change" ? <>
        <div className="cash-fast-balance">Troco total <strong>{money(paymentBalance(total,changePayments).change)}</strong></div>
        <label>Valor do troco por Pix<input inputMode="decimal" value={pix} onChange={event=>setPix(event.target.value)} /></label>
        <label>Conta de onde saiu o Pix<input value={source} onChange={event=>setSource(event.target.value)} /></label>
        <small className="cash-fast-hint">Faça a devolução antes de finalizar. O sistema apenas registra.</small>
      </> : null}
      {step === "pix" ? <><p className="cash-fast-hint">Se o cliente precisar digitar a chave em vez de ler o QR Code:</p><strong className="cash-pix-key">{pixKey}</strong></> : null}
      {error || notice ? <p className="cash-fast-error" role="alert">{error || notice}</p> : null}
    </div>
    {step !== "choose" ? <footer className="cash-fast-footer"><button type="button" disabled={busy} onClick={step === "change" ? ()=>setStep(changeReturn) : back}>Voltar</button>
      {step !== "pix" ? <button type="button" className="commerce-primary-action" disabled={busy} onClick={()=>{
        if(step === "cash") finishCash();
        else if(step === "split") add();
        else if(step === "special") {if(validateDeferredSale(name)){setError(validateDeferredSale(name));return;}void complete([],method,{name,deferred:true});}
        else if(step === "change") {try{const value=parseCashAmount(pix);splitChange(paymentBalance(total,changePayments).change,value);if(value>0&&!source.trim())throw Error("Informe a conta usada no troco por Pix.");void complete(changePayments,"cash",{changePix:value,changeSource:source});}catch(cause){setError((cause as Error).message);}}
      }}>{busy ? "Finalizando…" : step === "split" ? balance.remaining === 0 ? "Tentar finalizar novamente" : "Adicionar pagamento" : "Finalizar venda"}</button> : null}
    </footer> : busy ? <p role="status">Finalizando…</p> : null}
  </div></div>;
}
