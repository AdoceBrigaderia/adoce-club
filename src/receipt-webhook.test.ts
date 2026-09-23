import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), media: vi.fn() }));
vi.mock("../netlify/functions/_shared/whatsapp-auth", () => ({
  env: (key: string) => ({ WHATSAPP_ORDER_BOT_ENABLED:"true", TWILIO_AUTH_TOKEN:"test", TWILIO_ACCOUNT_SID:"ACtest", TWILIO_WHATSAPP_ORDER_WEBHOOK_URL:"https://example.com/hook", TWILIO_WHATSAPP_FROM:"whatsapp:+5585000000000", AUTH_RATE_LIMIT_HMAC_SECRET:"test" })[key],
  hmacHex: async () => "hash", normalizeBrazilPhone: () => "+5585999990000", serviceClient: () => ({ rpc: mock.rpc, schema:()=>({from:()=>({insert:async()=>({error:null})})}) }),
}));
vi.mock("twilio", () => ({ default: { validateRequest: () => true } }));
vi.mock("../netlify/functions/_shared/whatsapp-media", () => ({downloadAndStoreTwilioMedia: mock.media}));
import webhook from "../netlify/functions/twilio-whatsapp-order";
function request(body="", media=true) {
  return new Request("https://example.com/hook",{method:"POST",headers:{"x-twilio-signature":"test"},body:new URLSearchParams({From:"whatsapp:+5585999990000",To:"whatsapp:+5585000000000",MessageSid:"SM1234567890",Body:body,NumMedia:media?"1":"0",MediaUrl0:media?"https://api.twilio.com/media":"",MediaContentType0:"image/jpeg"})});
}
beforeEach(() => {
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-09-15T13:00:00-03:00"));
  mock.rpc.mockReset(); mock.media.mockReset();
  mock.media.mockResolvedValue({storagePath:"receipts/test.jpg",contentType:"image/jpeg",sizeBytes:12,filename:"test.jpg",kind:"image"});
  mock.rpc.mockImplementation(async (name: string,args:any) => ({data: name === "server_observe_whatsapp_message" ? {id:"thread-test",automation_mode:"bot"} : name === "server_finish_observed_whatsapp_message" ? args.requested_response_xml : name === "server_prepare_whatsapp_order_message" ? {process:true,allowed:true,conversation:{step:"completed",state:{}}} : name === "server_save_order_receipt" ? {order_number:"FAT-20260915-TEST"} : null, error:null}));
});
afterEach(()=>vi.useRealTimers());
describe("comprovante depois do pedido", () => {
  it("guarda a imagem e vincula sem pedir opção numérica nem aprovar pagamento", async () => {
    const response=await webhook(request());
    expect(await response.text()).toContain("FAT-20260915-TEST");
    expect(mock.media).toHaveBeenCalledOnce();
    expect(mock.rpc).toHaveBeenCalledWith("server_save_order_receipt",expect.objectContaining({requested_phone:"+5585999990000",requested_message_sid:"SM1234567890"}));
    expect(mock.rpc.mock.calls.some(([name])=>String(name).includes("confirm_instant_order_payment"))).toBe(false);
  });
  it("falha de armazenamento não é confirmada como recebimento", async () => {
    mock.media.mockRejectedValue(new Error("media_upload"));
    const response=await webhook(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("Comprovante guardado");
    expect(mock.rpc).not.toHaveBeenCalledWith("server_finish_observed_whatsapp_message",expect.anything());
  });
  it("foto de referência no orçamento continua no atendimento humano",async()=>{
    mock.rpc.mockImplementation(async(name:string,args:any)=>({data:name==="server_observe_whatsapp_message"?{id:"thread-test",automation_mode:"human"}:name==="server_finish_observed_whatsapp_message"?args.requested_response_xml:name==="server_prepare_whatsapp_order_message"?{process:true,allowed:true,conversation:{step:"handoff",state:{department:"quote"}}}:name==="server_append_whatsapp_support_message"?"thread-test":null,error:null}));
    const response=await webhook(request("foto do bolo que eu gostaria"));
    expect(response.status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith("server_store_whatsapp_inbound_media",expect.anything());
    expect(mock.rpc).not.toHaveBeenCalledWith("server_save_order_receipt",expect.anything());
  });
  it("recebe comprovante no domingo fora do atendimento",async()=>{
    vi.setSystemTime(new Date("2026-09-20T23:00:00-03:00"));
    expect(await (await webhook(request())).text()).toContain("Comprovante guardado");
  });
});
