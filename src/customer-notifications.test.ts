import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>({create:vi.fn(),list:vi.fn(),rpc:vi.fn(),template:""}));
vi.mock("twilio",()=>({default:()=>({messages:{create:mock.create,list:mock.list}})}));
vi.mock("../netlify/functions/_shared/whatsapp-auth",()=>({
  env:(key:string)=>({AUTH_RATE_LIMIT_HMAC_SECRET:"test",TWILIO_ACCOUNT_SID:"AC00000000000000000000000000000000",TWILIO_AUTH_TOKEN:"test",TWILIO_WHATSAPP_FROM:"whatsapp:+5585000000000",TWILIO_CUSTOMER_ORDER_STAGE_CONTENT_SID:mock.template})[key],
  hmacHex:async()=>"f".repeat(64),
  normalizeBrazilPhone:(phone:string)=>phone,
}));
import{deliverCustomerNotices}from"../netlify/functions/_shared/customer-notifications";
beforeEach(()=>{
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-09-15T13:00:00-03:00"));
  mock.template="";mock.rpc.mockReset();mock.create.mockReset();mock.list.mockReset();
  let claimed=false;
  mock.rpc.mockImplementation(async(name:string)=>{
    if(name==="server_claim_order_customer_notice"&&!claimed){claimed=true;return{data:{id:1,attempt:1,snapshot:{customer_name:"Teste",customer_phone:"+5585999990000",order_number:"FAT-TEST",status:"awaiting_payment",payment_method_code:"pix",total:32}},error:null};}
    return{data:null,error:null};
  });
  mock.list.mockResolvedValue([{dateSent:new Date("2026-09-15T12:00:00-03:00")}]);
  mock.create.mockResolvedValue({sid:"SMaccepted"});
});
afterEach(()=>vi.useRealTimers());
describe("envio oficial das etapas",()=>{
  it("usa o remetente oficial e o telefone do cliente, nunca o operador",async()=>{
    await deliverCustomerNotices({rpc:mock.rpc} as never,"order");
    expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({from:"whatsapp:+5585000000000",to:"whatsapp:+5585999990000",body:expect.stringContaining("pagamento@adocebrigaderia.com.br"),statusCallback:expect.stringContaining("attempt=1")}));
    expect(mock.rpc).toHaveBeenCalledWith("server_finish_order_customer_notice",expect.objectContaining({requested_status:"accepted",requested_sid:"SMaccepted",requested_attempt:1}));
  });
  it("fora da janela não tenta texto livre sem modelo aprovado",async()=>{
    mock.list.mockResolvedValue([]);await deliverCustomerNotices({rpc:mock.rpc} as never,"order");
    expect(mock.create).not.toHaveBeenCalled();
    expect(mock.rpc).toHaveBeenCalledWith("server_finish_order_customer_notice",expect.objectContaining({requested_status:"failed",requested_error:"template_required"}));
  });
  it("usa modelo configurado fora da janela",async()=>{
    mock.list.mockResolvedValue([]);mock.template="HXtest";await deliverCustomerNotices({rpc:mock.rpc} as never,"order");
    const args=mock.create.mock.calls[0][0];expect(args.contentSid).toBe("HXtest");expect(args.body).toBeUndefined();
  });
  it("timeout após envio não dispara repetição cega",async()=>{
    mock.create.mockRejectedValue(new Error("timeout"));await deliverCustomerNotices({rpc:mock.rpc} as never,"order");
    expect(mock.create).toHaveBeenCalledOnce();expect(mock.rpc).toHaveBeenCalledWith("server_finish_order_customer_notice",expect.objectContaining({requested_status:"uncertain"}));
  });
  it("grava o texto na inbox antes de enviar e atualiza a confirmação",async()=>{
    await deliverCustomerNotices({rpc:mock.rpc} as never,"order");
    const history=mock.rpc.mock.calls.filter(([name])=>name==="server_record_whatsapp_stage_message");
    expect(history).toHaveLength(2);
    expect(history[0][1].requested_body).toContain("Aguardando envio");
    expect(history[1][1].requested_source_sid).toBe("SMaccepted");
  });
});

describe("chave Pix configurável", () => {
  it("usa a chave cadastrada em Configurações nas mensagens automáticas", async () => {
    const { orderStageMessage } = await import("../netlify/functions/_shared/order-stage-message");
    const message = orderStageMessage({ customer_name: "Ana", order_number: "FAT-1", status: "awaiting_payment", total: 16, payment_method_code: "pix", payment_url: null, pickup_label: "Adoce", pickup_address: "Rua" }, "financeiro@adoce.com.br");
    expect(message).toContain("Chave (e-mail): financeiro@adoce.com.br");
    expect(message).not.toContain("pagamento@adocebrigaderia.com.br");
  });
});
