import{beforeEach,describe,expect,it,vi}from'vitest';
const state=vi.hoisted(()=>({mode:'bot',assigned:null as string|null,rpc:vi.fn(),send:vi.fn(),authorized:true}));
vi.mock('../netlify/functions/_shared/whatsapp-auth',()=>({
 env:(key:string)=>({TWILIO_ACCOUNT_SID:'ACtest',TWILIO_AUTH_TOKEN:'test',TWILIO_WHATSAPP_FROM:'whatsapp:+5585000000000'})[key],
 json:(value:unknown,status=200)=>new Response(JSON.stringify(value),{status}),
 serviceClient:()=>({rpc:state.rpc}),
 authorizeStaffRequest:async()=>state.authorized?{actorUserId:'staff',errorResponse:null}:{actorUserId:null,errorResponse:new Response('',{status:401})},
}));
vi.mock('twilio',()=>({default:()=>{const messages:any=()=>({fetch:async()=>({from:'whatsapp:+5585000000000',to:'whatsapp:+5585999990000'})});messages.create=state.send;return{messages};}}));
import support from '../netlify/functions/whatsapp-support';
const request=(action:string)=>new Request('https://example.com/api/whatsapp/support',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,threadId:'10000000-0000-4000-8000-000000000001',body:'Resposta de teste'})});
beforeEach(()=>{state.mode='bot';state.assigned=null;state.authorized=true;state.rpc.mockReset();state.send.mockReset();state.send.mockResolvedValue({sid:'SMstaffreply'});state.rpc.mockImplementation(async(name:string)=>({data:name==='server_get_whatsapp_support_thread'?{id:'10000000-0000-4000-8000-000000000001',status:'waiting',source_message_sid:'SMsource000',automation_mode:state.mode,assigned_staff_user_id:state.assigned}:null,error:null}));});
describe('controle de conversa pelo WhatsApp oficial',()=>{
 it('encerra chat do robo sem enviar mensagem nem exigir tomada',async()=>{expect((await support(request('close'))).status).toBe(200);expect(state.send).not.toHaveBeenCalled();expect(state.rpc).toHaveBeenCalledWith('server_end_whatsapp_support_chat',expect.objectContaining({requested_staff_user_id:'staff'}));});
 it('nao envia resposta antes de assumir a conversa',async()=>{expect((await support(request('reply'))).status).toBe(409);expect(state.send).not.toHaveBeenCalled();});
 it('assumir e devolver nao enviam mensagens nem apagam o carrinho',async()=>{expect((await support(request('takeover'))).status).toBe(200);expect((await support(request('resume'))).status).toBe(200);expect(state.send).not.toHaveBeenCalled();expect(state.rpc).not.toHaveBeenCalledWith('server_clear_whatsapp_order_conversation',expect.anything());});
 it('responde pelo oficial a conversa iniciada por aviso de pedido do site',async()=>{state.mode='human';state.assigned='staff';expect((await support(request('reply'))).status).toBe(200);expect(state.send).toHaveBeenCalledWith(expect.objectContaining({from:'whatsapp:+5585000000000',to:'whatsapp:+5585999990000'}));});
 it('recusa acesso sem sessao da equipe',async()=>{state.authorized=false;expect((await support(request('takeover'))).status).toBe(401);expect(state.rpc).not.toHaveBeenCalled();});
});
