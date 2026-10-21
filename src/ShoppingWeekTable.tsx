import {useState,useRef} from "react";
import {dayLabel,shiftDate,shortShoppingDate,weekDates,type ShoppingWeek} from "./lib/shopping-week";

export default function ShoppingWeekTable({week,plan,totals,flavors,disabled,onChange,batterColors={}}:{week:string;plan:ShoppingWeek;totals:Record<string,number>;flavors:{id:string;name:string;active:boolean}[];disabled:boolean;onChange:(group:"daily"|"cakes",key:string,value:number)=>void;batterColors?:Record<string,string|null>}){
 const [order,setOrder]=useState("name");
 const scroll=useRef<HTMLDivElement>(null);
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
 const unassigned=Object.values(plan.cakes).some(value=>value>0);
 const legacy=Object.values(plan.daily).some(value=>value>1);
 const change=(group:"daily"|"cakes",key:string,value:string)=>{const q=Number(value);if(Number.isSafeInteger(q)&&q>=0)onChange(group,key,q);};
 return <>
  <div className="adoce-items-filters"><label>Ordenar sabores<select value={order} onChange={event=>setOrder(event.target.value)}><option value="name">Nome A–Z</option><option value="desc">Nome Z–A</option><option value="total">Mais tortas na semana</option><option value="massa">Massa branca primeiro, depois por cor</option></select></label></div>
  {unassigned&&<p className="adoce-cost-pending">Há quantidades do planejamento anterior a distribuir. Preencha os dias: essas quantidades serão distribuídas automaticamente, sem contar duas vezes. O cardápio e os lotes usam somente os dias preenchidos.</p>}
  {legacy&&<p className="adoce-cost-pending">Há dias com mais de uma torta salvos anteriormente. Eles foram preservados. Desmarque e marque novamente para passar a uma torta naquele dia.</p>}
  <div className="adoce-table-scroll-controls"><button type="button" onClick={()=>scroll.current?.scrollBy({left:-280,behavior:"smooth"})}>← Dias anteriores</button><button type="button" onClick={()=>scroll.current?.scrollBy({left:280,behavior:"smooth"})}>Próximos dias →</button></div>
  <div ref={scroll} className="adoce-shopping-week-scroll" tabIndex={0} aria-label={`Planejamento de ${shortShoppingDate(week)} a ${shortShoppingDate(shiftDate(week,6))}`}>
   <table className="adoce-shopping-week-table"><thead><tr><th scope="col">Sabor</th><th scope="col">Massa predominante</th>{dates.map(date=><th scope="col" key={date}>{dayLabel(date)}</th>)}{unassigned&&<th scope="col">A distribuir</th>}<th scope="col">Total da semana</th></tr></thead>
    <tbody>{rows.map(flavor=><tr key={flavor.id}><th scope="row">{flavor.name}{!flavor.active&&<small>Inativo</small>}</th><td data-label="Massa predominante">{batterColors[flavor.id]||"—"}</td>{dates.map(date=><td key={date}><button type="button" className="adoce-shopping-day" aria-label={`${flavor.name} em ${shortShoppingDate(date)}`} aria-pressed={(plan.daily[`${date}|${flavor.id}`]||0)>0} disabled={disabled} onClick={()=>onChange("daily",`${date}|${flavor.id}`,plan.daily[`${date}|${flavor.id}`]>0?0:1)}>{plan.daily[`${date}|${flavor.id}`]>0?`✓ ${plan.daily[`${date}|${flavor.id}`]}`:"—"}</button></td>)}{unassigned&&<td><input aria-label={`${flavor.name} a distribuir`} disabled={disabled} type="number" min="0" step="1" inputMode="numeric" value={plan.cakes[flavor.id]||""} placeholder="0" onChange={event=>change("cakes",flavor.id,event.target.value)} /></td>}<td><strong>{totals[flavor.id]||0}</strong></td></tr>)}</tbody>
    <tfoot><tr><th scope="row">Total por dia</th><td></td>{dates.map(date=><td key={date}><strong>{Object.entries(plan.daily).filter(([key])=>key.startsWith(date+"|")).reduce((sum,[,value])=>sum+value,0)}</strong></td>)}{unassigned&&<td>{Object.values(plan.cakes).reduce((sum,value)=>sum+value,0)}</td>}<td><strong>{Object.values(totals).reduce((sum,value)=>sum+value,0)}</strong></td></tr></tfoot>
   </table>
  </div><p className="adoce-shopping-scroll-hint">No celular, deslize a tabela para ver todos os dias. O sabor e o total continuam visíveis.</p>
 </>;
}
