import {useState} from "react";
import {dayLabel,requiredDayWarnings,shiftDate,shortShoppingDate,weekDates,type ShoppingWeek} from "./lib/shopping-week";
import {formatCurrency} from "./lib/cost-format";
import CostSheetTable from "./CostSheetTable";

type FlavorEconomics = { salePrice: number | null; unitCost: number | null; marginPercent: number | null; slicesPerCake: number | null };

const formatPercent=(value:number)=>`${value.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
// Regra do proprietario (22/10/2026): a partir de 26/10/2026, só se pode
// marcar sabor num dia que já esteja marcado como "dia obrigatório".
// Planejamentos de dias anteriores a essa data ficam como estavam, sem a
// restrição, para não travar nada já planejado.
export const REQUIRED_DAY_RULE_START="2026-10-26";
export const canMarkFlavorOnDay=(date:string,plan:ShoppingWeek)=>date<REQUIRED_DAY_RULE_START||Boolean(plan.requiredDays?.[date]);

export default function ShoppingWeekTable({week,plan,totals,flavors,disabled,onChange,batterColors={},flavorEconomics={}}:{week:string;plan:ShoppingWeek;totals:Record<string,number>;flavors:{id:string;name:string;active:boolean}[];disabled:boolean;onChange:(group:"daily"|"cakes"|"requiredDays",key:string,value:number|boolean)=>void;batterColors?:Record<string,string|null>;flavorEconomics?:Record<string,FlavorEconomics>}){
 const [order,setOrder]=useState("name");
 const dates=weekDates(week);
 const massaCompare=(a:{id:string;name:string},b:{id:string;name:string})=>{
  const colorA=batterColors[a.id]||"";
  const colorB=batterColors[b.id]||"";
  const groupA=colorA==="Branca"?0:1;
  const groupB=colorB==="Branca"?0:1;
  if(groupA!==groupB)return groupA-groupB;
  if(groupA===1&&colorA!==colorB)return (colorA||"~sem massa").localeCompare(colorB||"~sem massa","pt-BR");
  return a.name.localeCompare(b.name,"pt-BR");
 };
 const rows=flavors.filter(flavor=>flavor.active||totals[flavor.id]>0).sort((a,b)=>order==="total"?(totals[b.id]||0)-(totals[a.id]||0)||a.name.localeCompare(b.name,"pt-BR"):order==="massa"?massaCompare(a,b):(order==="desc"?-1:1)*a.name.localeCompare(b.name,"pt-BR"));
 const warnings=requiredDayWarnings(plan,week,flavors,batterColors);
 const unassigned=Object.values(plan.cakes).some(value=>value>0);
 const legacy=Object.values(plan.daily).some(value=>value>1);
 const change=(group:"daily"|"cakes",key:string,value:string)=>{const q=Number(value);if(Number.isSafeInteger(q)&&q>=0)onChange(group,key,q);};
 let anyMissingEconomics=false;
 const dayResult=(date:string)=>{
  let revenue=0,cost=0;
  for(const[key,qty]of Object.entries(plan.daily)){
   if(!key.startsWith(date+"|")||!qty)continue;
   const econ=flavorEconomics[key.slice(date.length+1)];
   if(!econ||econ.salePrice==null||econ.unitCost==null||!econ.slicesPerCake){anyMissingEconomics=true;continue;}
   revenue+=qty*econ.slicesPerCake*econ.salePrice;
   cost+=qty*econ.slicesPerCake*econ.unitCost;
  }
  return{revenue,cost};
 };
 const weekResult=()=>{
  let revenue=0,cost=0;
  for(const[flavorId,qty]of Object.entries(totals)){
   if(!qty)continue;
   const econ=flavorEconomics[flavorId];
   if(!econ||econ.salePrice==null||econ.unitCost==null||!econ.slicesPerCake){anyMissingEconomics=true;continue;}
   revenue+=qty*econ.slicesPerCake*econ.salePrice;
   cost+=qty*econ.slicesPerCake*econ.unitCost;
  }
  return{revenue,cost};
 };
 const dayResults=dates.map(date=>({date,...dayResult(date)}));
 const weekTotal=weekResult();
 return <>
  <div className="adoce-items-filters"><label>Ordenar sabores<select value={order} onChange={event=>setOrder(event.target.value)}><option value="name">Nome A–Z</option><option value="desc">Nome Z–A</option><option value="total">Mais tortas na semana</option><option value="massa">Massa branca primeiro, depois por cor</option></select></label></div>
  {dates.some(date=>date>=REQUIRED_DAY_RULE_START)&&<p className="adoce-cost-pending">A partir de {shortShoppingDate(REQUIRED_DAY_RULE_START)}, só é possível marcar um sabor num dia depois de marcar esse dia como "obrigatório". Desmarcar continua liberado em qualquer dia.</p>}
  {unassigned&&<p className="adoce-cost-pending">Há quantidades do planejamento anterior a distribuir. Preencha os dias: essas quantidades serão distribuídas automaticamente, sem contar duas vezes. O cardápio e os lotes usam somente os dias preenchidos.</p>}
  {legacy&&<p className="adoce-cost-pending">Há dias com mais de uma torta salvos anteriormente. Eles foram preservados. Desmarque e marque novamente para passar a uma torta naquele dia.</p>}
  <CostSheetTable scrollAmount={280} prevLabel="← Dias anteriores" nextLabel="Próximos dias →" className="adoce-shopping-week-scroll" label={`Planejamento de ${shortShoppingDate(week)} a ${shortShoppingDate(shiftDate(week,6))}`}>
   <table className="adoce-shopping-week-table"><thead>
    <tr><th scope="col">Sabor</th><th scope="col">Massa predominante</th><th scope="col">Margem da fatia</th>{dates.map(date=><th scope="col" key={date}>{dayLabel(date)}</th>)}{unassigned&&<th scope="col">A distribuir</th>}<th scope="col">Total da semana</th></tr>
    <tr><th scope="row">Dia obrigatório</th><td></td><td></td>{dates.map(date=><td key={date}><label><input type="checkbox" disabled={disabled} checked={Boolean(plan.requiredDays?.[date])} onChange={event=>onChange("requiredDays",date,event.target.checked)} /> obrigatório</label></td>)}{unassigned&&<td></td>}<td></td></tr>
   </thead>
    <tbody>{rows.map(flavor=><tr key={flavor.id}><th scope="row">{flavor.name}{!flavor.active&&<small>Inativo</small>}</th><td data-label="Massa predominante">{batterColors[flavor.id]||"—"}</td><td data-label="Margem da fatia">{flavorEconomics[flavor.id]?.marginPercent!=null?formatPercent(flavorEconomics[flavor.id].marginPercent!):"—"}</td>{dates.map(date=>{const marked=(plan.daily[`${date}|${flavor.id}`]||0)>0;const canMark=marked||canMarkFlavorOnDay(date,plan);return <td key={date}><button type="button" className="adoce-shopping-day" aria-label={`${flavor.name} em ${shortShoppingDate(date)}`} aria-pressed={marked} disabled={disabled||!canMark} title={canMark?undefined:"Marque este dia como obrigatório antes de escolher sabores"} onClick={()=>{if(!canMark)return;onChange("daily",`${date}|${flavor.id}`,marked?0:1);}}>{marked?`✓ ${plan.daily[`${date}|${flavor.id}`]}`:"—"}</button></td>;})}{unassigned&&<td><input aria-label={`${flavor.name} a distribuir`} disabled={disabled} type="number" min="0" step="1" inputMode="numeric" value={plan.cakes[flavor.id]||""} placeholder="0" onChange={event=>change("cakes",flavor.id,event.target.value)} /></td>}<td><strong>{totals[flavor.id]||0}</strong></td></tr>)}</tbody>
    <tfoot>
     <tr><th scope="row">Total por dia</th><td></td><td></td>{dates.map(date=><td key={date}><strong>{Object.entries(plan.daily).filter(([key])=>key.startsWith(date+"|")).reduce((sum,[,value])=>sum+value,0)}</strong></td>)}{unassigned&&<td>{Object.values(plan.cakes).reduce((sum,value)=>sum+value,0)}</td>}<td><strong>{Object.values(totals).reduce((sum,value)=>sum+value,0)}</strong></td></tr>
     <tr className="adoce-shopping-result-row"><th scope="row">Previsão de venda</th><td></td><td></td>{dayResults.map(({date,revenue})=><td key={date}>{formatCurrency(revenue)}</td>)}{unassigned&&<td></td>}<td><strong>{formatCurrency(weekTotal.revenue)}</strong></td></tr>
     <tr className="adoce-shopping-result-row"><th scope="row">Previsão de custo</th><td></td><td></td>{dayResults.map(({date,cost})=><td key={date}>{formatCurrency(cost)}</td>)}{unassigned&&<td></td>}<td><strong>{formatCurrency(weekTotal.cost)}</strong></td></tr>
     <tr className="adoce-shopping-result-row"><th scope="row">Resultado (R$)</th><td></td><td></td>{dayResults.map(({date,revenue,cost})=><td key={date}><strong>{formatCurrency(revenue-cost)}</strong></td>)}{unassigned&&<td></td>}<td><strong>{formatCurrency(weekTotal.revenue-weekTotal.cost)}</strong></td></tr>
     <tr className="adoce-shopping-result-row"><th scope="row">Resultado (%)</th><td></td><td></td>{dayResults.map(({date,revenue,cost})=><td key={date}><strong>{revenue>0?formatPercent((revenue-cost)/revenue*100):"—"}</strong></td>)}{unassigned&&<td></td>}<td><strong>{weekTotal.revenue>0?formatPercent((weekTotal.revenue-weekTotal.cost)/weekTotal.revenue*100):"—"}</strong></td></tr>
    </tfoot>
   </table>
  </CostSheetTable><p className="adoce-shopping-scroll-hint">No celular, deslize a tabela para ver todos os dias. O sabor e o total continuam visíveis.</p>
  {anyMissingEconomics&&<p className="adoce-cost-pending">Previsão de venda/custo/resultado não inclui sabor(es) sem ficha de custo completa (custo da fatia, preço de venda e rendimento em fatias por torta cadastrados). Complete a ficha na aba "Fichas por sabor" para entrar no cálculo.</p>}
  {warnings.length>0&&<div className="adoce-cost-pending" role="alert"><strong>Dias obrigatórios fora da regra (mínimo de 6 sabores, sendo ao menos 1/3 de massa branca)</strong><ul>{warnings.map(warning=><li key={warning.date}>{dayLabel(warning.date)}: {warning.flavorCount} sabor(es), {warning.whiteCount} de massa branca</li>)}</ul></div>}
 </>;
}
