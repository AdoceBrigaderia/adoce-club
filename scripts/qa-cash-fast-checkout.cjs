const {chromium} = require('C:/Users/RubensBezerra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const browser = await chromium.launch({headless:true});
  try {
    const results=[];
    for(const [surface,width,height] of [['desktop',1440,900],['tablet',1280,800],['mobile',390,844],['small-mobile',360,640]]) {
      const page=await browser.newPage({viewport:{width,height}});page.setDefaultTimeout(10000);
      const errors=[]; const calls=[]; const prints=[];const listQueries=[];let number=0;let failNext=false;let slowPrint=false;let listMode="normal";
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{if(['error','warning'].includes(message.type()) && !/Failed to load resource.*500/.test(message.text()))errors.push(message.text());});
      const methods=['cash','pix','credit_card','debit_card','payroll'];
      await page.route('**/rest/v1/**',async route=>{
        const url=new URL(route.request().url());const endpoint=url.pathname.split('/').pop();let data=[];let status=200;let headers={};
        if(endpoint==='flavors')data=[{id:'f1',name:'Chocolate',base_price:10}];
        if(endpoint==='flavor_availability')data=[{flavor_id:'f1',status:'available',quantity_available:20,quantity_reserved:0}];
        if(endpoint==='staff_get_commerce_settings')data={pix_key:'teste@example.com',payment_methods:methods.map(code=>({code,label:code,active:true}))};
        if(endpoint==='staff_get_business_workspace')data={role:'admin',stores:[{id:'s1',name:'Teste',active:true}],registers:[{id:'r1',store_id:'s1',name:'Caixa 1',active:true}],sessions:[{id:'c1',store_id:'s1',register_id:'r1',status:'open'}]};
        if(endpoint==='cash_sessions')data={session_number:1,opened_at:new Date().toISOString(),opening_float:20};
        if(endpoint==='cash_movements')data=Array.from({length:10},(_,i)=>({id:`m${i}`,kind:'sale',direction:'in',payment_method_code:'cash',amount:10,notes:`Movimento ${i}`,created_at:new Date().toISOString()}));
        if(endpoint==='staff_cash_closing_report')data={session:{id:'c1',opening_float:20,expected_cash:120},slices:[{name:'Chocolate',quantity:10}],payments:[{method:'cash',amount:100}],pending:[{customer_name:'Ana',order_number:'P1',remaining:10}]};
        if(endpoint==='staff_set_cash_draft_reservation')data={accepted:true};
        if(['staff_create_manual_sale_in_cash_v6','staff_create_deferred_cash_sale','staff_create_loyalty_cash_sale'].includes(endpoint)) {
          calls.push({endpoint,...route.request().postDataJSON()});await sleep(80);
          if(failNext){failNext=false;status=500;data={message:'Falha simulada: tente novamente.'};}
          else data={order_id:`o${++number}`,order_number:`T${number}`,total:10,remaining:0};
        }
        if(endpoint==='instant_orders'&&url.searchParams.has('payment_deferred')) {data=Array.from({length:8},(_,i)=>({id:`p${i}`,order_number:`P${i}`,customer_name:`Pendente ${i}`,total:10,amount_paid:0}));
        } else if(endpoint==='instant_orders'&&url.searchParams.has('cash_register_id')) {
          assert.equal(url.searchParams.get('cash_register_id'),'eq.r1');assert.equal(url.searchParams.get('store_id'),'eq.s1');assert.equal(url.searchParams.get('sales_channel'),'eq.operation');
          const dateFilters=url.searchParams.getAll('created_at');assert(dateFilters.some(value=>value.startsWith('gte.')));assert(dateFilters.some(value=>value.startsWith('lt.')));
          listQueries.push(url.toString());const offset=Number(url.searchParams.get('offset')||0);const limit=Number(url.searchParams.get('limit')||5);
          data=Array.from({length:8},(_,index)=>({id:`r${index}`,order_number:`R${index}`,customer_name:`Cliente ${index}`,total:10,created_at:new Date().toISOString()})).slice(offset,offset+limit);
          if(listMode==='empty')data=[];
          if(listMode==='error'){status=500;data={message:'Falha de leitura simulada'};}
          headers={'content-range':listMode==='empty'?'*/0':`${offset}-${offset+data.length-1}/8`,'access-control-expose-headers':'content-range'};
        } else if(endpoint==='instant_orders') {
          if(slowPrint)await sleep(1500);
          const target=(url.searchParams.get('id')||`eq.o${number}`).replace('eq.','');
          data={id:target,order_number:target.startsWith('r')?`R${target.slice(1)}`:`T${number}`,total:10,amount_paid:10,customer_name:'Teste',created_at:new Date().toISOString(),payment_allocations:[{method:'pix',amount:10}],instant_order_items:[{id:'i1',flavor_name:'Chocolate',quantity:1,unit_price:10}]};
        }
        if(endpoint==='staff_queue_print_job'){prints.push(route.request().postDataJSON());data={accepted:true};}
        await route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(data)});
      });
      await page.route('**/.netlify/functions/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"threads":[]}'}));
      await page.goto('http://localhost:4185/entregas/qa-impressao-opcional.html',{waitUntil:'networkidle',timeout:30000});
      await page.reload({waitUntil:'networkidle',timeout:30000});
      const fit=async label=>{
        const geometry=await page.getByRole('dialog').evaluate(el=>{const rect=el.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,height:rect.height,scroll:el.scrollHeight,client:el.clientHeight,viewport:innerHeight};});
        assert(geometry.top>=0&&geometry.bottom<=height+1,`${surface}/${label}: janela fora da tela ${JSON.stringify(geometry)}`);
        assert(geometry.scroll<=geometry.client+2,`${surface}/${label}: precisa rolar ${JSON.stringify(geometry)}`);
        await page.screenshot({path:`entregas/caixa-rapido-${surface}-${label}.png`});
      };
      const open=async()=>{
        await page.getByRole('button',{name:'Chocolate R$'}).click();
        await page.getByRole('button',{name:width<900?'Cobrar':'Finalizar venda',exact:true}).click();
        assert.equal(await page.getByRole('checkbox',{name:'Imprimir cupom'}).isChecked(),false);
      };
      const done=async()=>{await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText('Seu carrinho está vazio.').waitFor({state:'attached'});};
      for(const [label,code] of [['Pix','pix'],['Crédito','credit_card'],['Débito','debit_card'],['Desconto em folha','payroll']]) {
        await open();if(code==='pix')await fit('formas');await page.getByRole('button',{name:label,exact:true}).click();await done();
        assert.deepEqual(calls.at(-1).requested_payments,[{method:code,amount:10}]);
      }
      await open();await page.getByRole('button',{name:'Dinheiro',exact:true}).click();
      assert.equal(await page.getByLabel('Valor recebido').inputValue(),'10');await fit('dinheiro');
      await page.getByRole('dialog').getByRole('button',{name:'Finalizar venda',exact:true}).click();await done();assert.deepEqual(calls.at(-1).requested_payments,[{method:'cash',amount:10}]);
      await open();await page.getByRole('button',{name:'Dinheiro',exact:true}).click();await page.getByLabel('Valor recebido').fill('20');
      await fit('troco');await page.getByRole('dialog').getByRole('button',{name:'Finalizar venda',exact:true}).click();await done();assert.deepEqual(calls.at(-1).requested_payments,[{method:'cash',amount:20}]);
      await open();await page.getByRole('button',{name:'Pagar com duas ou mais formas'}).click();await fit('dividido');
      await page.getByLabel('Forma',{exact:true}).selectOption('pix');await page.getByLabel('Valor deste pagamento').fill('4');await page.getByRole('button',{name:'Adicionar pagamento',exact:true}).click();
      const before=calls.length;assert.equal(await page.getByRole('dialog').count(),1);
      await page.getByLabel('Forma',{exact:true}).selectOption('debit_card');await page.getByLabel('Valor deste pagamento').fill('7');await page.getByRole('button',{name:'Adicionar pagamento',exact:true}).click();assert.equal(calls.length,before);
      await page.getByLabel('Valor deste pagamento').fill('6');await page.getByRole('button',{name:'Adicionar pagamento',exact:true}).click();await done();assert.deepEqual(calls.at(-1).requested_payments,[{method:'pix',amount:4},{method:'debit_card',amount:6}]);
      await open();await page.getByRole('button',{name:'Pagar com duas ou mais formas'}).click();
      for(const code of ['pix','credit_card','debit_card','payroll']) {await page.getByLabel('Forma',{exact:true}).selectOption(code);await page.getByLabel('Valor deste pagamento').fill('1');await page.getByRole('button',{name:'Adicionar pagamento',exact:true}).click();}
      await page.getByLabel('Forma',{exact:true}).selectOption('cash');await page.getByLabel('Valor deste pagamento').fill('20');await fit('dividido-5-formas');await page.getByRole('checkbox',{name:'Devolver troco por Pix'}).check();
      await page.getByRole('button',{name:'Adicionar pagamento',exact:true}).click();await fit('troco-pix');await page.getByLabel('Valor do troco por Pix').fill('2');await page.getByRole('dialog').getByRole('button',{name:'Finalizar venda',exact:true}).click();await done();assert.equal(calls.at(-1).requested_change.pix,2);assert.equal(calls.at(-1).requested_payments.length,5);
      await open();await page.getByRole('button',{name:'Pagar com duas ou mais formas'}).click();
      await page.getByLabel('Forma',{exact:true}).selectOption('pix');await page.getByLabel('Valor deste pagamento').fill('3');await page.getByRole('button',{name:'Adicionar pagamento',exact:true}).click();
      await page.getByLabel('Forma',{exact:true}).selectOption('credit_card');await page.getByLabel('Valor deste pagamento').fill('7');failNext=true;await page.getByRole('button',{name:'Adicionar pagamento',exact:true}).click();
      await page.getByRole('alert').filter({hasText:'Falha simulada'}).waitFor();await fit('dividido-erro');const failedSplit=calls.at(-1);
      await page.getByRole('button',{name:'Tentar finalizar novamente',exact:true}).click();await done();assert.deepEqual(calls.at(-1).requested_payments,failedSplit.requested_payments);assert.equal(calls.at(-1).requested_operation_key,failedSplit.requested_operation_key);
      await open();await page.getByRole('button',{name:'Outras opções',exact:true}).click();await fit('pendente');
      await page.getByLabel('Tipo de lançamento').selectOption('loyalty');await fit('fidelidade');await page.getByRole('button',{name:'Voltar',exact:true}).click();
      await page.getByRole('button',{name:'Cadastrar no Clube',exact:true}).click();await fit('clube');await page.getByRole('button',{name:'Voltar',exact:true}).click();await page.getByRole('button',{name:'Chave Pix',exact:true}).click();await fit('chave-pix');await page.getByRole('button',{name:'Voltar',exact:true}).click();await page.getByRole('button',{name:'Fechar pagamento'}).click();
      // Failures retain the cart and the same idempotency key for a safe retry.
      await page.getByRole('button',{name:width<900?'Cobrar':'Finalizar venda',exact:true}).click();failNext=true;
      await page.getByRole('button',{name:'Pix',exact:true}).click();await page.getByRole('alert').filter({hasText:'Falha simulada'}).waitFor();
      const failedKey=calls.at(-1).requested_operation_key;await page.getByRole('button',{name:'Pix',exact:true}).click();await done();assert.equal(calls.at(-1).requested_operation_key,failedKey);
      // Two rapid clicks still create one sale.
      await open();const beforeDouble=calls.length;await page.getByRole('button',{name:'Pix',exact:true}).evaluate(el=>{el.click();el.click();});await done();assert.equal(calls.length,beforeDouble+1);
      // Slow receipt retrieval must not hold the next order.
      await open();await page.getByRole('checkbox',{name:'Imprimir cupom'}).check();slowPrint=true;
      const start=Date.now();await page.getByRole('button',{name:'Pix',exact:true}).click();await done();const returnMs=Date.now()-start;assert(returnMs<1200,`Cupom bloqueou tela por ${returnMs}ms`);
      await page.waitForFunction(()=>document.body.innerText.includes('enviado para impressão.'));assert.equal(prints.length,1);slowPrint=false;
      await open();await page.getByRole('button',{name:'Fechar pagamento'}).click();
      await page.getByRole('button',{name:'Editar quantidade de Chocolate'}).click();await fit('quantidade');await page.getByRole('button',{name:'Fechar teclado'}).click();
      await page.getByRole('button',{name:'Reimprimir vendas de hoje',exact:true}).click();await page.getByRole('button',{name:'Reimprimir R0'}).waitFor();await fit('reimpressao');
      await page.getByRole('button',{name:'Próxima',exact:true}).click();await page.getByRole('button',{name:`Reimprimir R${height<700?3:5}`} ).waitFor();await fit('reimpressao-pagina2');
      await page.getByRole('button',{name:`Reimprimir R${height<700?3:5}`} ).click();await page.getByRole('dialog').getByText(/Cupom R\d+ enviado para impressão/).waitFor();assert.equal(prints.length,2);
      await page.getByRole('button',{name:'Fechar reimpressão'}).click();
      listMode='empty';await page.getByRole('button',{name:'Reimprimir vendas de hoje',exact:true}).click();await page.getByText('Nenhuma venda registrada neste caixa hoje.').waitFor();await fit('reimpressao-vazia');await page.getByRole('button',{name:'Fechar reimpressão'}).click();
      listMode='error';await page.getByRole('button',{name:'Reimprimir vendas de hoje',exact:true}).click();await page.getByRole('button',{name:'Tentar novamente',exact:true}).waitFor();await fit('reimpressao-erro');listMode='normal';await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await page.getByRole('button',{name:'Reimprimir R0'}).waitFor();await page.getByRole('button',{name:'Fechar reimpressão'}).click();
      await page.getByRole('button',{name:'Cancelar pedido',exact:true}).click();
      await page.getByRole('button',{name:'Clube da última venda',exact:true}).click();await fit('clube-pos-venda');await page.getByRole('button',{name:'Fechar cadastro'}).click();
      await page.locator('.cash-admin-menu > summary').click();
      for(const label of ['Sangria','Suprimento','Perda de fatias']) {
        await page.getByRole('button',{name:label,exact:true}).click();await fit(label.toLowerCase().replaceAll(' ','-'));
        await page.getByRole('button',{name:'Registrar',exact:true}).click();await page.getByRole('alert').waitFor();await fit('erro-ajuste');await page.getByRole('button',{name:'Fechar',exact:true}).click();
      }
      await page.getByRole('button',{name:'Conferir caixa e despesas',exact:true}).click();await page.getByRole('button',{name:'Lançar despesa',exact:true}).waitFor();await fit('conferencia');
      await page.getByRole('button',{name:'Lançar despesa',exact:true}).click();await fit('despesa');await page.getByRole('button',{name:'Voltar à conferência',exact:true}).click();
      await page.getByRole('button',{name:'Ver movimentações',exact:true}).click();await fit('movimentos');await page.getByRole('dialog').getByRole('button',{name:'Próxima',exact:true}).click();await fit('movimentos-pagina2');
      await page.getByRole('button',{name:'Voltar à conferência',exact:true}).click();await page.getByRole('button',{name:'Conferir fatias, pagamentos e pendências',exact:true}).click();await fit('resumo');await page.getByRole('dialog').getByRole('button',{name:'Próxima',exact:true}).click();await fit('resumo-pagina2');await page.getByRole('button',{name:'Fechar conferência',exact:true}).click();
      await page.getByRole('button',{name:'Pagamentos pendentes',exact:true}).click();await page.getByRole('button',{name:/Pendente 0/}).waitFor();await fit('lista-pendentes');await page.getByRole('button',{name:/Pendente 0/}).click();await fit('receber-pendente');await page.getByRole('button',{name:'Fechar janela do caixa'}).click();
      await page.getByRole('button',{name:'Fechar caixa',exact:true}).click();await fit('fechamento');await page.getByRole('button',{name:'Fechar janela do caixa'}).click();
      assert.deepEqual(errors,[]);results.push({surface,width,height,sales:number,printJobs:prints.length,returnMs,reprintPages:listQueries.length,errors});await page.close();
    }
    fs.writeFileSync('entregas/qa-caixa-rapido-20261008.json',JSON.stringify({scope:'Componente real com API simulada; sem vendas ou impressões reais',results},null,2));console.log(results);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
