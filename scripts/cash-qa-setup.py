from pathlib import Path
p=Path(__file__).resolve().parents[1]
for name in ['instant-order-foundation.test.ts','operation-information-architecture.test.ts']:
 f=p/'src'/name;s=f.read_text(encoding='utf-8').replace('sales: "/operacao/pedidos?tipo=vendas"','sales: "/operacao/caixa"').replace('expect(access).toContain("Pedidos")','expect(access).toContain("Caixa")');f.write_text(s,encoding='utf-8')
q=p/'evidence/20260917-cash';q.mkdir(exist_ok=True)
(q/'vite.config.mjs').write_text("import {defineConfig} from 'vite';import {resolve} from 'node:path';export default defineConfig({resolve:{dedupe:['react','react-dom'],alias:[{find:/.*\\/lib\\/supabase$/,replacement:resolve('evidence/20260917-cash/mock.ts')}]},server:{host:'127.0.0.1',port:5192,strictPort:true}});",encoding='utf-8')
(q/'ui.html').write_text('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Caixa — validação isolada</title><div id="root"></div><script type="module" src="./ui.tsx"></script></html>',encoding='utf-8')
(q/'frame.html').write_text('<html><body style="margin:0"><iframe title="Caixa celular" style="width:375px;height:812px;border:0" src="ui.html"></iframe></body></html>',encoding='utf-8')
(q/'tablet.html').write_text('<html><body style="margin:0"><iframe title="Caixa tablet" style="width:1024px;height:768px;border:0" src="ui.html"></iframe></body></html>',encoding='utf-8')
(q/'ui.tsx').write_text('''import React from 'react';import {createRoot} from 'react-dom/client';import Cash from '../../src/OperationManualSale';import '../../src/styles.css';import '../../src/theme.css';import '../../src/adoce-tokens.css';import '../../src/access-app.css';import '../../src/operation-v3.css';import '../../src/operation-tablet.css';import '../../src/cash-register-layout.css';
window.fetch=async()=>new Response(JSON.stringify({threads:[]}));
createRoot(document.getElementById('root')!).render(<div className="operation-home"><div className="operation-shell"><aside><button>Hoje</button><button>Caixa</button><button>Produtos</button><button>Clientes</button><button>Configurações</button></aside><main><Cash onCreated={()=>{}} /></main></div></div>);''',encoding='utf-8')
mock=(p/'evidence/20260915-order-repair/mock-supabase.ts').read_text(encoding='utf-8')
mock=mock.replace("const id=", "const flavors=['Black Velvet','Ninho','Trufado','Alpino','Brigadeiro','Morango','Maracujá','Dois Amores','Limão','Oreo','Cenoura','Red Velvet'].map((name,i)=>({id:'f'+(i+1),name,short_name:name,base_price:16}));\nconst id=")
a=mock.index("table==='flavors'?");b=mock.index(':[]))',a)
mock=mock[:a]+"table==='flavors'?flavors:table==='order_sauces'?[{id:'s1',name:'Chocolate'},{id:'s2',name:'Ninho'}]:table==='flavor_availability'?flavors.map(f=>({flavor_id:f.id,status:'available',quantity_available:20,quantity_reserved:0}))"+mock[b:]
mock=mock.replace("if(name==='staff_get_commerce_settings')", "if(name==='staff_get_business_workspace')return result({role:'owner',stores:[{id:'store',name:'Adoce',active:true}],registers:[{id:'reg',store_id:'store',name:'Caixa',active:true}],sessions:[{id:'sess',store_id:'store',register_id:'reg',status:'open'}]});\nif(name==='staff_set_cash_draft_reservation')return result({accepted:true});\nif(name==='staff_get_commerce_settings')")
(q/'mock.ts').write_text(mock,encoding='utf-8')
