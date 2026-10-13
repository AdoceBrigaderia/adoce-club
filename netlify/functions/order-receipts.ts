import { authorizeStaffRequest, isUuid, json, serviceClient } from "./_shared/whatsapp-auth";
export default async (request: Request) => {
  if (request.method !== "GET") return json({error:"Método não permitido."},405);
  const admin=serviceClient();
  if (!admin) return json({error:"Serviço indisponível."},503);
  const auth=await authorizeStaffRequest(request,admin);
  if(auth.errorResponse) return auth.errorResponse;
  const orderId=new URL(request.url).searchParams.get("order_id") || "";
  if(!isUuid(orderId)) return json({error:"Pedido inválido."},400);
  const {data,error}=await admin.rpc("server_list_order_receipts",{requested_order_id:orderId});
  if(error) return json({error:"Não foi possível consultar os comprovantes."},503);
  try {
    const receipts=await Promise.all((data || []).map(async (row: {id:string;storage_path:string;content_type:string;created_at:string})=>{
      const signed=await admin.storage.from("order-payment-receipts").createSignedUrl(row.storage_path,300);
      if(signed.error || !signed.data?.signedUrl) throw Error("signed_url");
      return {id:row.id,content_type:row.content_type,created_at:row.created_at,url:signed.data.signedUrl};
    }));
    return json({receipts});
  } catch { return json({error:"Não foi possível abrir os comprovantes. Tente atualizar."},503); }
};
export const config={path:"/api/orders/receipts"};
