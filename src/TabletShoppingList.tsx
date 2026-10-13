import {displayShoppingQuantity, type PlanItem, type shoppingQuantity} from './lib/purchase-planner';
import {compareShoppingOffer} from './lib/shopping-offer';
import type {ShoppingWeek} from './lib/shopping-week';
type Row={item:PlanItem}&ReturnType<typeof shoppingQuantity>;
const money=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function TabletShoppingList({rows,plan,disabled,onChange,onBack}:{rows:Row[];plan:ShoppingWeek;disabled:boolean;onChange:(group:keyof ShoppingWeek,key:string,value:number|boolean)=>void;onBack:()=>void}){
 const checked=rows.filter(row=>plan.inCart?.[row.item.id]).length;
 return <section className="adoce-tablet-shopping"><header><div><h4>Lista de compras</h4><p>{checked} de {rows.length} itens no carrinho · marque conforme for pegando.</p></div><button type="button" onClick={onBack}>Voltar ao planejamento</button></header>
 <div className="adoce-tablet-shopping-grid">{rows.map(row=>{
  const id=row.item.id,unit=row.item.consumption_unit;
  const scale=unit==='g'||unit==='ml'?1000:1;
  const measure=unit==='g'||unit==='kg'?'kg':unit==='ml'||unit==='l'?'l':'un';
  const weightLabel=unit==='g'?'Peso de cada unidade (g)':unit==='kg'?'Peso de cada unidade (kg)':unit==='ml'?'Volume de cada unidade (ml)':unit==='l'?'Volume de cada unidade (l)':'Conteúdo de cada unidade (un)';
  const units=plan.quoteUnits?.[id]||0,weight=unit==='unit'?1:plan.quoteWeight?.[id]||0,price=plan.quotePrice?.[id]||0;
  const comparison=compareShoppingOffer(units,weight,price,row.required,row.stock,row.lastPrice?.perMeasure??null,scale);
  const field=(label:string,group:'quoteUnits'|'quoteWeight'|'quotePrice',value:number)=><label>{label}<input aria-label={`${label} · ${row.item.name}`} disabled={disabled} type="number" min="0" step={group==='quoteUnits'?'1':'any'} inputMode={group==='quoteUnits'?'numeric':'decimal'} value={value||''} placeholder="0" onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0&&(group!=='quoteUnits'||Number.isSafeInteger(n)))onChange(group,id,n);}}/></label>;
  return <article key={id} className={`adoce-shopping-list-row ${plan.inCart?.[id]?'in-cart':''}`}><label className="adoce-shopping-list-check"><input type="checkbox" disabled={disabled} checked={plan.inCart?.[id]===true} aria-label={`${row.item.name} no carrinho`} onChange={e=>onChange('inCart',id,e.target.checked)}/><span><strong>{row.item.name}</strong><small>Comprar: {displayShoppingQuantity(row.buy,unit)} · {row.packages==null?'Embalagem pendente':`${row.packages} ${row.packageName}`}<br/>Estoque: {displayShoppingQuantity(row.stock,unit)}</small></span></label>
   <details className="adoce-shopping-price-details"><summary>Comparar preço</summary><p>Última compra: <strong>{row.lastPrice?`${money(row.lastPrice.perMeasure)}/${row.lastPrice.measure}`:'Preço não cadastrado'}</strong>{row.lastPrice?.perPackage!=null&&<><br/><strong>{money(row.lastPrice.perPackage)}/{row.lastPrice.packageName}</strong></>}</p>
   <div className="adoce-shopping-offer-fields">{field('Unidades na embalagem','quoteUnits',units)}{unit!=='unit'&&field(weightLabel,'quoteWeight',weight)}{field('Preço da embalagem (R$)','quotePrice',price)}</div>
   {comparison?<div className={`adoce-shopping-comparison ${comparison.difference!=null&&comparison.difference<0?'better':''}`} role="status"><strong>{money(comparison.perMeasure)}/{measure}</strong><p>{comparison.difference==null?'Sem preço anterior para comparar.':Math.abs(comparison.difference)<.01?'Mesmo custo da última compra.':`${Math.abs(comparison.difference).toLocaleString('pt-BR',{maximumFractionDigits:1})}% ${comparison.difference<0?'mais barato — melhor preço':'mais caro que a última compra'}.`}</p><strong>{comparison.packages===0?'Estoque suficiente':`Comprar ${comparison.packages} ${comparison.packages===1?'embalagem':'embalagens'} deste tamanho`}</strong></div>:<p className="adoce-shopping-card-hint">Preencha a embalagem para comparar o preço.</p>}
   </details></article>;
 })}</div>{!rows.length&&<p>Selecione os dias e os itens no planejamento para montar a lista.</p>}<p>A comparação é uma cotação. O custo cadastrado só muda quando a compra é registrada em uma nota.</p></section>;
}
