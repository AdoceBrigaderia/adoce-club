import twilio from "twilio";
import {env,json,serviceClient} from "./_shared/whatsapp-auth";
import { PRODUCTION_SITE_ORIGIN } from "./_shared/production-origin";
export default async(request:Request)=>{
  if(request.method!=="POST")return json({},405);
  const raw=await request.text();if(raw.length>16384)return json({},413);
  const id=new URL(request.url).searchParams.get("notice_id")||"";
  const attempt=new URL(request.url).searchParams.get("attempt")||"";
  if(!/^\d{1,15}$/.test(id)||!/^\d{1,2}$/.test(attempt)||Number(attempt)<1)return json({},400);
  // Avisos enviados antes da migração ainda retornam ao endereço antigo.
  const urls=[PRODUCTION_SITE_ORIGIN,"https://www.adocebrigaderia.com.br"].map(origin=>`${origin}/api/twilio/customer-order-status?notice_id=${id}&attempt=${attempt}`);
  const form=new URLSearchParams(raw),token=env("TWILIO_AUTH_TOKEN")||"";
  if(!token||!urls.some(url=>twilio.validateRequest(token,request.headers.get("x-twilio-signature")||"",url,Object.fromEntries(form))))return json({},401);
  const sid=form.get("MessageSid")||"",provider=form.get("MessageStatus")||"";
  if(!/^[A-Z]{2}[a-f0-9]{32}$/i.test(sid))return json({},400);
  const status=provider==="read"?"read":provider==="delivered"?"delivered":["failed","undelivered"].includes(provider)?"failed":"accepted";
  const admin=serviceClient();if(!admin)return json({},503);
  const result=await admin.rpc("server_customer_notice_callback",{requested_id:Number(id),requested_sid:sid,requested_status:status,requested_error:form.get("ErrorCode")||null,requested_attempt:Number(attempt)});
  return json({ok:!result.error},result.error?503:200);
};
export const config={path:"/api/twilio/customer-order-status"};
