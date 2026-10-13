import {shoppingQuantity,shoppingReceipt} from '../src/lib/purchase-planner.ts';
import {writeFileSync,readFileSync} from 'node:fs';
import {weeklyMenuReceipt,emptyShoppingWeek} from '../src/lib/shopping-week.ts';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/RubensBezerra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const examples=[
 {id:'sugar',name:'Açúcar refinado',unit:'g',ref:1000,required:2500,stock:700,bought:5000,total:29.5,outer:5},
 {id:'chocolate',name:'Chocolate meio amargo',unit:'g',ref:1000,required:3200,stock:1200,bought:2000,total:116,outer:2},
 {id:'box',name:'Embalagens para fatias',unit:'unit',ref:10,required:65,stock:15,bought:50,total:25,outer:5},
];
const rows=examples.map(e=>{
 const item={id:e.id,name:e.name,internal_code:e.id,item_kind:e.unit==='unit'?'packaging':'ingredient',consumption_unit:e.unit,active:true,reference_quantity:e.ref,reference_unit:e.unit,reference_package_name:'pacote'};
 const invoices=[{issued_on:'2026-10-10',created_at:'2026-10-10',lines:[{item_id:e.id,brand_name:'',package_layers:[{name:'pacote',quantity:String(e.outer)}],normalized_quantity:e.bought,normalized_unit:e.unit,outer_unit_price:e.total/e.outer,gross_total:e.total,net_total:e.total}]}];
 return {item,...shoppingQuantity(item,e.required,e.stock,invoices)};
});
const lines=shoppingReceipt(5,rows);lines.splice(1,0,'Semana: 12/10 a 18/10');writeFileSync('entregas/previa-lista-compras-precos-20261011.txt',lines.join('\n'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const logo=readFileSync('public/site/adoce-logo-thermal.png').toString('base64');
const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>body{margin:0;padding:28px;background:#eceae6;display:flex;justify-content:center}.paper{background:white;padding:30px 24px;box-shadow:0 4px 18px #0002;width:32ch;font:18px/1.55 Consolas,'Courier New',monospace;color:#181818;white-space:pre}.paper img{display:block;margin:0 auto 18px;width:192px;height:192px;image-rendering:pixelated} </style><div class="paper"><img src="data:image/png;base64,${logo}" alt="Logo Adoce">${esc(lines.join('\n'))}</div></html>`;
writeFileSync('entregas/previa-lista-compras-precos-20261011.html',html);
const browser=await chromium.launch({headless:true});try{const page=await browser.newPage({viewport:{width:480,height:200},deviceScaleFactor:2});await page.setContent(html);await page.screenshot({path:'entregas/previa-lista-compras-precos-20261011.png',fullPage:true});const menu=weeklyMenuReceipt('2026-10-12',{...emptyShoppingWeek(),daily:{'2026-10-12|a':3,'2026-10-13|a':2,'2026-10-13|b':1,'2026-10-15|b':2}},[{id:'a',name:'Chocolate meio amargo'},{id:'b',name:'Morango com leite Ninho'}]);const menuHtml=html.replace(esc(lines.join('\n')),esc(menu.join('\n')));writeFileSync('entregas/previa-cardapio-semanal-20261011.html',menuHtml);await page.setContent(menuHtml);await page.screenshot({path:'entregas/previa-cardapio-semanal-20261011.png',fullPage:true});}finally{await browser.close();}
console.log(lines.join('\n'));
