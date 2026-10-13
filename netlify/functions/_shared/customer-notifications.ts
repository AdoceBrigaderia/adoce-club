import twilio from "twilio";
import {env,hmacHex,normalizeBrazilPhone,serviceClient} from "./whatsapp-auth";
import {orderStageMessage,type StageOrder} from "./order-stage-message";

export async function deliverCustomerNotices(admin:NonNullable<ReturnType<typeof serviceClient>>,orderId:string) {
  let sent=0;
  // Chave Pix configurada em Configurações → Loja e pagamentos.
  const pixKeyResult=await admin.rpc("server_get_pix_key");
  const pixKey=typeof pixKeyResult.data==="string"&&pixKeyResult.data.trim()?pixKeyResult.data.trim():undefined;
  for(let index=0;index<12;index+=1) {
    const claim=await admin.rpc("server_claim_order_customer_notice",{requested_order_id:orderId});
    if(claim.error) throw Error("notice_claim");
    if(!claim.data) break;
    const notice=claim.data as {id:number;attempt:number;snapshot:StageOrder & {customer_phone:string}};
    const account=env("TWILIO_ACCOUNT_SID"),token=env("TWILIO_AUTH_TOKEN"),official=env("TWILIO_WHATSAPP_FROM");
    const phone=normalizeBrazilPhone(notice.snapshot.customer_phone);
    let providerAccepted=false;
    let sendStarted=false;
    let recordHistory:((body:string,sourceSid?:string)=>Promise<void>)|null=null;
    let messageBody="";
    const finish=async(status:string,sid:string|null,error:string|null)=>{
      const saved=await admin.rpc("server_finish_order_customer_notice",{requested_id:notice.id,requested_status:status,requested_sid:sid,requested_error:error,requested_attempt:notice.attempt});
      if(saved.error) throw Error("notice_store");
    };
    try {
      if(!account||!token||!official||!phone) {await finish("failed",null,"configuration_missing");break;}
      const from=official.startsWith("whatsapp:")?official:`whatsapp:${official}`;
      const to=`whatsapp:${phone}`;
      const client=twilio(account,token,{autoRetry:false,timeout:8000});
      const recent=await client.messages.list({from:to,to:from,limit:1});
      const incoming=recent[0];
      const secret=env("AUTH_RATE_LIMIT_HMAC_SECRET");
      if(!secret) {await finish("failed",null,"configuration_missing");break;}
      const hash=await hmacHex(secret,`phone:${phone}`);
      const historySid=`NOTICE${notice.id}ATTEMPT${notice.attempt}`;
      recordHistory=async(body,sourceSid)=>{
        const saved=await admin.rpc("server_record_whatsapp_stage_message",{
          requested_phone_hmac:hash,requested_sid:historySid,requested_body:body,
          requested_phone_last4:phone.slice(-4),requested_source_sid:sourceSid||incoming?.sid||historySid,
        });
        if(saved.error) throw Error("notice_history");
      };
      messageBody=orderStageMessage(notice.snapshot,pixKey);
      await recordHistory(`[Aguardando envio ao WhatsApp]\n${messageBody}`);
      const withinWindow=Boolean(incoming?.dateSent && Date.now()-incoming.dateSent.getTime()<24*60*60*1000);
      const template=env("TWILIO_CUSTOMER_ORDER_STAGE_CONTENT_SID");
      if(!withinWindow&&!template) {await recordHistory(`[Não enviado: modelo aprovado necessário fora da janela de atendimento]\n${messageBody}`);await finish("failed",null,"template_required");break;}
      const body=orderStageMessage(notice.snapshot,pixKey);
      const callback=`https://www.adocebrigaderia.com.br/api/twilio/customer-order-status?notice_id=${notice.id}&attempt=${notice.attempt}`;
      sendStarted=true;
      const message=await client.messages.create({from,to,statusCallback:callback,
        ...(withinWindow?{body}:{contentSid:template!,contentVariables:JSON.stringify({
          "1":notice.snapshot.customer_name.trim().split(/\s+/)[0],"2":notice.snapshot.order_number,
          "3":body.replace(/^Olá,[\s\S]*?: /,"").replace(/\s+/g," "),
        })}),
      });
      providerAccepted=true;
      await finish("accepted",message.sid,null); sent+=1;
      await recordHistory(`[Aceito pelo WhatsApp para envio; confira a entrega no pedido]\n${body}`,message.sid);
    } catch(error) {
      const status=Number((error as {status?:number}).status||0);
      // Timeout depois de enviar e resultado sem persistencia sao incertos: nunca repetir cegamente.
      const uncertain=providerAccepted||(sendStarted && (!status||status>=500));
      await finish(uncertain?"uncertain":"failed",null,uncertain?"delivery_unknown":`provider_${String((error as {code?:string}).code||status||"unavailable").slice(0,30)}`);
      if(recordHistory) await recordHistory(`[${uncertain?"Envio sem confirmação; conferir no pedido antes de repetir":"Falha no envio"}]\n${messageBody}`).catch(()=>undefined);
      break;
    }
  }
  return sent;
}
