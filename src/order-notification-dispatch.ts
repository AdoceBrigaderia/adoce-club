import {requireSupabase} from "./lib/supabase";
import {Capacitor} from "@capacitor/core";
import {resolveApiRequestUrl} from "./lib/native-api";
// O evento ja esta persistido no banco. Esta chamada acelera o envio e recupera falha do webhook.
export async function dispatchOrderNotifications(orderId:string) {
  try {
    const {data}=await requireSupabase().auth.getSession();
    if(!data.session)return;
    await fetch(resolveApiRequestUrl("/api/hooks/orders/customer-notify",Capacitor.isNativePlatform()),{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({order_id:orderId})});
  } catch { /* O historico do pedido mantem o aviso pendente; nao repetir a mudanca de etapa. */ }
}
