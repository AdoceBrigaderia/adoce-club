import {timingSafeEqual} from "node:crypto";
import {authorizeStaffRequest,env,isUuid,json,serviceClient} from "./_shared/whatsapp-auth";
import {deliverCustomerNotices} from "./_shared/customer-notifications";
export default async(request:Request)=>{
  if(request.method!=="POST") return json({error:"Método não permitido."},405);
  const secret=env("ORDER_NOTIFICATION_WEBHOOK_SECRET") || "";
  const supplied=request.headers.get("x-adoce-webhook-secret") || "";
  const validSecret=secret.length>0 && Buffer.byteLength(secret)===Buffer.byteLength(supplied) && timingSafeEqual(Buffer.from(secret),Buffer.from(supplied));
  const admin=serviceClient(); if(!admin) return json({error:"Serviço indisponível."},503);
  if(!validSecret) {const auth=await authorizeStaffRequest(request,admin);if(auth.errorResponse)return auth.errorResponse;}
  const raw=await request.text();if(raw.length>4096)return json({error:"Requisição inválida."},413);
  let id="";try{id=String(JSON.parse(raw).order_id||"");}catch{return json({error:"Pedido inválido."},400);}
  if(!isUuid(id))return json({error:"Pedido inválido."},400);
  try{return json({accepted:await deliverCustomerNotices(admin,id)});}catch{return json({error:"Não foi possível processar os avisos. Confira o histórico do pedido."},503);}
};
export const config={path:"/api/hooks/orders/customer-notify",timeout:26};
