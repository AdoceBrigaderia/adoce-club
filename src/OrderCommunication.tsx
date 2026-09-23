import {useCallback,useEffect,useState} from "react";
import {requireSupabase} from "./lib/supabase";
import {Capacitor} from "@capacitor/core";
import {resolveApiRequestUrl} from "./lib/native-api";
import "./order-communication.css";
type Receipt={id:string;url:string;content_type:string;created_at:string};
type Notice={id:number;stage:string;status:string;last_error:string|null;created_at:string};
const stages:Record<string,string>={awaiting_confirmation:"Reserva recebida",reserved:"Reserva registrada",preparing:"Em separação",awaiting_payment:"Separação confirmada e cobrança",paid:"Pagamento confirmado",ready:"Liberado para retirada",completed:"Entregue",expired:"Prazo encerrado",cancelled:"Cancelado"};
const statuses:Record<string,string>={pending:"Aguardando envio",processing:"Enviando",accepted:"Aceito pelo WhatsApp",delivered:"Entregue",read:"Lido",failed:"Falha no envio",uncertain:"Envio sem confirmação — conferir com a equipe",superseded:"Etapa já avançou"};
export default function OrderCommunication({orderId}:{orderId:string}) {
  const [receipts,setReceipts]=useState<Receipt[]>([]),[notices,setNotices]=useState<Notice[]>([]);
  const [error,setError]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const load=useCallback(async(signal?:AbortSignal)=>{
    try {
      const client=requireSupabase();
      const {data:session}=await client.auth.getSession();
      if(!session.session)throw Error("Entre novamente para consultar os comprovantes.");
      const [response,history]=await Promise.all([
        fetch(resolveApiRequestUrl(`/api/orders/receipts?order_id=${orderId}${Capacitor.isNativePlatform()?`&_ts=${Date.now()}`:""}`,Capacitor.isNativePlatform()),{cache:"no-store",headers:{Authorization:`Bearer ${session.session.access_token}`},signal}),
        client.rpc("staff_list_order_customer_notices",{requested_order_id:orderId}),
      ]);
      const body=await response.json();
      if(!response.ok)throw Error(body.error||"Não foi possível consultar os comprovantes.");
      if(history.error)throw Error("Não foi possível consultar os avisos do WhatsApp.");
      if(!signal?.aborted){setReceipts(body.receipts||[]);setNotices(history.data||[]);setError("");}
    }catch(cause){if(!signal?.aborted)setError(cause instanceof Error?cause.message:"Falha ao atualizar.");}
    finally{if(!signal?.aborted)setLoading(false);}
  },[orderId]);
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);const timer=setInterval(()=>void load(controller.signal),20000);return()=>{controller.abort();clearInterval(timer);};},[load]);
  const retry=async()=>{
    setBusy(true);
    try {
      const client=requireSupabase();const result=await client.rpc("staff_retry_order_customer_notices",{requested_order_id:orderId});
      if(result.error)throw Error("Não foi possível preparar nova tentativa.");
      const {data}=await client.auth.getSession();
      const response=await fetch(resolveApiRequestUrl("/api/hooks/orders/customer-notify",Capacitor.isNativePlatform()),{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session?.access_token||""}`},body:JSON.stringify({order_id:orderId})});
      if(!response.ok)throw Error("Aviso não confirmado. Confira o histórico antes de tentar novamente.");
      await load();
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha no envio.");}finally{setBusy(false);}
  };
  return <section className="order-communication" aria-label="Comprovantes e avisos do pedido">
    <h3>Comprovantes do WhatsApp</h3>
    <p>Confira o arquivo e o recebimento na conta antes de confirmar o pagamento.</p>
    {loading?<p role="status">Carregando comprovantes…</p>:null}
    {error?<p role="alert">{error}</p>:null}
    {!loading&&!error&&!receipts.length?<p>Nenhum comprovante recebido neste pedido.</p>:null}
    {receipts.map(receipt=><figure key={receipt.id}>
      {receipt.content_type.startsWith("image/")?<a href={receipt.url} target="_blank" rel="noreferrer"><img src={receipt.url} alt="Comprovante enviado pelo cliente" loading="lazy" onError={()=>setError("Não foi possível exibir o comprovante. Use Atualizar comprovantes.")}/></a>:null}
      <figcaption><a href={receipt.url} target="_blank" rel="noreferrer">{receipt.content_type==="application/pdf"?"Abrir comprovante PDF":"Abrir imagem do comprovante"}</a><small>{new Date(receipt.created_at).toLocaleString("pt-BR")}</small></figcaption>
    </figure>)}
    <button type="button" onClick={()=>void load()} disabled={busy}>Atualizar comprovantes e avisos</button>
    <h3>Avisos pelo WhatsApp oficial</h3>
    {!loading&&!error&&!notices.length?<p>As próximas mudanças de etapa aparecerão aqui.</p>:null}
    <ul>{notices.map(notice=><li key={notice.id}><strong>{stages[notice.stage]||"Atualização do pedido"}</strong><span>{statuses[notice.status]||"Aguardando confirmação"}</span>{notice.last_error==="template_required"?<small>Fora da janela de atendimento. Falta configurar um modelo aprovado no WhatsApp.</small>:notice.last_error==="configuration_missing"?<small>Envio oficial depende de configuração do serviço.</small>:null}</li>)}</ul>
    {notices.some(notice=>["pending","failed"].includes(notice.status))?<button type="button" disabled={busy} onClick={()=>void retry()}>{busy?"Processando avisos…":"Tentar enviar avisos pendentes"}</button>:null}
  </section>;
}
