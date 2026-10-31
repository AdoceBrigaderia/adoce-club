import { useEffect, useRef, useState } from "react";
import { X, Printer } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { printCashSale } from "./lib/cash-sale-print";
import { cashDayRange } from "./cash-fast-checkout";
import { timeOnly } from "./lib/thermal-format";
import "./cash-fast-checkout.css";

type Sale = {id:string;order_number:string;customer_name:string;total:number;created_at:string;instant_order_items:Array<{id:string;flavor_name:string;quantity:number}>};
export default function CashReprintDialog({registerId,storeId,registerName,onClose}: {registerId:string;storeId:string;registerName:string;onClose:()=>void}) {
  const [rows,setRows] = useState<Sale[]>([]); const [page,setPage] = useState(0); const [count,setCount] = useState(0);
  const [loading,setLoading] = useState(true); const [busy,setBusy] = useState(""); const [notice,setNotice] = useState("");
  const [refresh,setRefresh] = useState(0);
  const [size,setSize] = useState(()=>window.innerHeight < 700 ? 3 : 5);
  const lock = useRef(false);
  const {day,start,end} = cashDayRange();
  const [rangeStart,setRangeStart] = useState(start);
  useEffect(()=>{const resize=()=>{setSize(window.innerHeight < 700 ? 3 : 5);setPage(0);};window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);},[]);
  // Mostra hoje e o último dia anterior que teve venda, não só hoje: o dia
  // de abertura do caixa pode não ter tido venda nenhuma, e quem precisa
  // reimprimir geralmente está procurando "a venda de ontem" logo cedo.
  useEffect(()=>{
    const abort = new AbortController();
    void (async()=>{
      const {data} = await requireSupabase().from("instant_orders")
        .select("created_at").eq("cash_register_id",registerId).eq("store_id",storeId).eq("sales_channel","operation")
        .lt("created_at",start).not("status","in","(cancelled,expired)")
        .order("created_at",{ascending:false}).limit(1).abortSignal(abort.signal);
      if(abort.signal.aborted) return;
      const previous = data?.[0]?.created_at as string | undefined;
      if(!previous) { setRangeStart(start); return; }
      const previousDay = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Fortaleza"}).format(new Date(previous));
      setRangeStart(new Date(`${previousDay}T00:00:00-03:00`).toISOString());
    })();return()=>abort.abort();
  },[registerId,storeId,start]);
  useEffect(()=>{
    const abort = new AbortController(); setLoading(true);setRows([]);setNotice("");
    void (async()=>{
      const {data,error,count:total} = await requireSupabase().from("instant_orders")
        .select("id,order_number,customer_name,total,created_at,instant_order_items(id,flavor_name,quantity)",{count:"exact"})
        .eq("cash_register_id",registerId).eq("store_id",storeId).eq("sales_channel","operation")
        .gte("created_at",rangeStart).lt("created_at",end).not("status","in","(cancelled,expired)")
        .order("created_at",{ascending:false}).order("id",{ascending:false}).range(page*size,page*size+size-1).abortSignal(abort.signal);
      if(abort.signal.aborted) return;
      if(error) setNotice("Não foi possível carregar as vendas deste caixa. Tente atualizar.");
      else {setRows((data || []) as Sale[]);setCount(total || 0);} setLoading(false);
    })();return()=>abort.abort();
  },[registerId,storeId,rangeStart,end,page,size,refresh]);
  useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key === "Escape"&&!lock.current)onClose();};window.addEventListener("keydown",escape);return()=>window.removeEventListener("keydown",escape);},[onClose]);
  const print = async (sale:Sale) => {
    if(lock.current) return;lock.current=true;setBusy(sale.id);setNotice("");
    try {await printCashSale(sale.id);setNotice(`Cupom ${sale.order_number} enviado para impressão.`);}
    catch {setNotice("Não foi possível enviar o cupom. Confira a conexão e tente novamente.");}
    finally {lock.current=false;setBusy("");}
  };
  return <div className="cash-modal-backdrop cash-fast-backdrop"><div className="cash-modal cash-fast-modal cash-reprint-modal" role="dialog" aria-modal="true" aria-labelledby="cash-reprint-title">
    <header className="cash-fast-heading"><div><h3 id="cash-reprint-title">Reimprimir vendas</h3><p>{registerName} · {rangeStart===start ? day.split("-").reverse().join("/") : `desde ${new Intl.DateTimeFormat("en-CA",{timeZone:"America/Fortaleza"}).format(new Date(rangeStart)).split("-").reverse().join("/")} até ${day.split("-").reverse().join("/")}`}</p></div><button type="button" className="cash-modal-close" disabled={Boolean(busy)} onClick={onClose} aria-label="Fechar reimpressão"><X /></button></header>
    <div className="cash-fast-body">{loading ? <p role="status">Carregando vendas…</p> : rows.length ? <div className="cash-reprint-list">{rows.map(sale=><article key={sale.id}><div><strong>{sale.order_number} · {timeOnly(sale.created_at)}</strong><span>{sale.customer_name || "Venda presencial"}</span><ul className="cash-reprint-items">{(sale.instant_order_items||[]).map(item=><li key={item.id}>{item.quantity}× {item.flavor_name}</li>)}</ul><b>{Number(sale.total).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</b></div><button type="button" disabled={Boolean(busy)} onClick={()=>void print(sale)} aria-label={`Reimprimir ${sale.order_number}`}><Printer />{busy===sale.id ? "Enviando…" : "Imprimir"}</button></article>)}</div> : !notice ? <p role="status">Nenhuma venda registrada neste caixa hoje.</p> : null}
      {notice ? <p role="status" className="cash-fast-message">{notice}</p> : null}{!loading && !rows.length && notice ? <button type="button" onClick={()=>setRefresh(value=>value+1)}>Tentar novamente</button> : null}
    </div>
    <footer className="cash-fast-footer cash-reprint-pages"><button type="button" disabled={loading || Boolean(busy) || page===0} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>{count ? `${page+1} / ${Math.ceil(count/size)}` : "0 vendas"}</span><button type="button" disabled={loading || Boolean(busy) || (page+1)*size>=count} onClick={()=>setPage(value=>value+1)}>Próxima</button></footer>
  </div></div>;
}
