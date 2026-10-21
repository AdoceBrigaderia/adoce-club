import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { planDemand, shoppingQuantity, shoppingReceipt, displayShoppingQuantity, predominantBatterColor, type PlanWorkspace, type PlanInvoice } from "./lib/purchase-planner";
import { useShoppingPlanSync } from "./lib/shopping-plan-sync";
import { queuePrint } from "./lib/print-queue";
import { requireSupabase } from "./lib/supabase";
import ShoppingWeekTable from "./ShoppingWeekTable";
import TabletShoppingList from "./TabletShoppingList";
import PurchaseWeeklyReport from "./PurchaseWeeklyReport";
import ThermalShoppingPreview, {brandedThermalLines} from "./ThermalShoppingPreview";
import {weekStart,localShoppingDate,weekDates,shiftDate,shortShoppingDate,weeklyTotals,weeklyMenuReceipt,shoppingWeekOptions} from "./lib/shopping-week";

export default function CostShoppingPlanner({ workspace, invoices, flavors, active = true }: { active?: boolean; workspace: PlanWorkspace; invoices: PlanInvoice[]; flavors: { id: string; name: string; active: boolean }[] }) {
 const [week,setWeek]=useState(()=>weekStart(localShoppingDate()));
 const weeks=useMemo(()=>shoppingWeekOptions(week),[week]);
 const {plan,saved,ready,saving,dirty,status,change,save,discard,retry,copyPrevious}=useShoppingPlanSync(week);
 const {extras,stock,selected}=plan;
 const cakes=useMemo(()=>weeklyTotals(plan,week),[plan,week]);
 const savedCakes=useMemo(()=>weeklyTotals(saved,week),[saved,week]);
 const changeWeek=(next:string)=>{if(dirty&&!window.confirm("Há alterações não salvas no planejamento. Elas serão descartadas. Continuar?"))return;setWeek(next);};
 const [search,setSearch]=useState("");
 const [sort,setSort]=useState("name");
 const [extraId,setExtraId]=useState("");
 const [printing,setPrinting]=useState(false);
 const [tabletMode,setTabletMode]=useState(false);
 const [reportMode,setReportMode]=useState(false);
 const [printNotice,setPrintNotice]=useState("");
 const [importStart,setImportStart]=useState(week);
 const [importEnd,setImportEnd]=useState(shiftDate(week,6));
 const [importing,setImporting]=useState(false);
 const [importNotice,setImportNotice]=useState("");
 const runImport=async()=>{
  setImporting(true);setImportNotice("");
  try{
   const {data,error}=await requireSupabase().rpc("manager_import_shopping_plan_availability",{start_date:importStart,end_date:importEnd});
   if(error)throw error;
   const result=data as {imported_count:number;skipped_count:number;removed_count:number;removal_blocked_count:number};
   const parts=[
    result.imported_count?`${result.imported_count} sabor(es)/dia importado(s)`:null,
    result.removed_count?`${result.removed_count} removido(s) do site (não estão mais no planejamento)`:null,
    result.skipped_count?`${result.skipped_count} ignorado(s) por sabor inexistente`:null,
    result.removal_blocked_count?`${result.removal_blocked_count} não pôde(ram) ser removido(s) por já ter fatia reservada`:null,
   ].filter(Boolean);
   setImportNotice(parts.length?parts.join(", ")+".":"Nenhuma mudança: ninguém marcado nem removido nesse período.");
  }catch(error){setImportNotice(error instanceof Error?error.message:"Não foi possível importar. Tente novamente.");}
  finally{setImporting(false);}
 };
 const batterColors=useMemo(()=>Object.fromEntries(flavors.map(flavor=>[flavor.id,predominantBatterColor(flavor.id,workspace)])),[flavors,workspace]);
 const demand=useMemo(()=>planDemand(workspace,savedCakes),[workspace,savedCakes]);
 const combined=useMemo(()=>planDemand(workspace,savedCakes,saved.extras),[workspace,savedCakes,saved.extras]);
 const total=Object.values(cakes).reduce((sum,value)=>sum+(Number.isSafeInteger(value)&&value>0?value:0),0);
 const savedTotal=Object.values(savedCakes).reduce((sum,value)=>sum+(Number.isSafeInteger(value)&&value>0?value:0),0);
 const items=workspace.items.filter(item=>item.active||extras[item.id]>0).sort((a,b)=>sort==="code"?a.internal_code.localeCompare(b.internal_code,"pt-BR",{numeric:true}):sort==="quantity"?(demand.quantities[b.id]||0)-(demand.quantities[a.id]||0):a.name.localeCompare(b.name,"pt-BR"));
 const rows=items.filter(item=>(demand.quantities[item.id]>0&&saved.selected[item.id]!==false)||saved.extras[item.id]>0).map(item=>({item,...shoppingQuantity(item,(saved.selected[item.id]!==false?demand.quantities[item.id]||0:0)+(saved.extras[item.id]||0),saved.stock[item.id]||0,invoices)}));
 const lines=shoppingReceipt(savedTotal,rows);
 lines.splice(1,0,`Semana: ${shortShoppingDate(week)} a ${shortShoppingDate(shiftDate(week,6))}`);
 const menuLines=weeklyMenuReceipt(week,plan,flavors);
 const hasMenu=weekDates(week).some(date=>Object.entries(plan.daily).some(([key,value])=>key.startsWith(date+"|")&&value>0));
 const print=async(menu=false)=>{
  setPrinting(true);setPrintNotice("");
  try{await queuePrint(menu?"Cardápio da semana":"Lista de compras",brandedThermalLines(menu?menuLines:lines));setPrintNotice(`${menu?"Cardápio enviado":"Lista enviada"} à fila da impressora térmica. O tablet precisa estar conectado e atualizado para imprimir a logo.`);}
  catch{setPrintNotice("Não foi possível enviar a impressão. Confira a conexão e tente novamente.");}
  finally{setPrinting(false);}
 };
 const stockField=(id:string,unit:string)=>{
  const factor=unit==="g"||unit==="ml"?1000:1;
  return <label>Estoque atual ({unit==="g"?"kg":unit==="ml"?"l":unit==="unit"?"unidades":unit})<input disabled={!ready} type="number" min="0" step="any" inputMode="decimal" value={stock[id]?stock[id]/factor:""} placeholder="0" onChange={event=>{const value=Number(event.target.value);if(Number.isFinite(value)&&value>=0)change("stock",id,value*factor);}} /></label>;
 };
 return <section className="adoce-preparation-list adoce-shopping-planner">
  <h4>Planejamento das compras da semana</h4><p>Marque os dias de cada sabor: cada dia selecionado vale uma torta G. A lista acrescenta 20% de segurança ao consumo previsto, desconta o estoque aproveitável e só então arredonda os pacotes.</p>
  <p role="status">{status}</p><button type="button" onClick={retry}>Tentar novamente / atualizar</button>
  {dirty&&<div className="adoce-cost-pending" role="alert"><strong>Há alterações não salvas.</strong> A lista de compras só é recalculada depois de salvar.<div className="adoce-section-actions"><button type="button" disabled={saving} onClick={()=>void save()}>{saving?"Salvando…":"Salvar planejamento"}</button><button type="button" disabled={saving} onClick={discard}>Descartar alterações</button></div></div>}
  <button type="button" disabled={!ready} onClick={()=>{setTabletMode(current=>!current);setReportMode(false);}}>{tabletMode?'Voltar ao planejamento':'Modo compras no tablet'}</button>
  <button type="button" onClick={()=>{setReportMode(current=>!current);setTabletMode(false);}}>{reportMode?'Voltar ao planejamento':'Comprado por semana'}</button>
  {tabletMode&&combined.errors.length>0&&<div className="adoce-cost-pending" role="alert"><strong>Lista incompleta: revise as fichas antes de comprar.</strong><ul>{combined.errors.map(error=><li key={error}>{error}</li>)}</ul></div>}
  {reportMode?<PurchaseWeeklyReport invoices={invoices} items={workspace.items}/>:tabletMode?<TabletShoppingList rows={rows} plan={plan} week={week} disabled={!ready} onChange={change} onBack={()=>setTabletMode(false)}/>:<>
  <div className="adoce-items-filters"><label>Ordenar itens<select value={sort} onChange={event=>setSort(event.target.value)}><option value="name">Nome A–Z</option><option value="code">Código</option><option value="quantity">Maior quantidade necessária</option></select></label></div>
  <div className="adoce-shopping-week-controls"><label>Selecionar semana<select value={week} disabled={saving} onChange={event=>changeWeek(event.target.value)}>{[...new Set(weeks.map(option=>option.group))].map(group=><optgroup label={group} key={group}>{weeks.filter(option=>option.group===group).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>)}</select></label><button type="button" disabled={saving} onClick={()=>changeWeek(shiftDate(week,-7))}>Semana anterior</button><button type="button" disabled={saving} onClick={()=>changeWeek(weekStart(localShoppingDate()))}>Semana vigente</button><button type="button" disabled={saving} onClick={()=>changeWeek(shiftDate(week,7))}>Próxima semana</button><button type="button" disabled={!ready||saving||total>0} onClick={()=>void copyPrevious(shiftDate(week,-7))}>Copiar semana anterior como modelo</button></div>
  <h4>Semana de {shortShoppingDate(week)} a {shortShoppingDate(shiftDate(week,6))}</h4>
  <ShoppingWeekTable week={week} plan={plan} totals={cakes} flavors={flavors} disabled={!ready} onChange={change} batterColors={batterColors}/>
  <div className="adoce-shopping-import">
   <h4>Importar planejamento para o site</h4>
   <p>Para cada dia marcado no período, cria um lote de 13 fatias por torta planejada, disponível a partir das 18h. Não reduz reservas que clientes já fizeram.</p>
   <label>De<input type="date" value={importStart} onChange={event=>setImportStart(event.target.value)} /></label>
   <label>Até<input type="date" value={importEnd} onChange={event=>setImportEnd(event.target.value)} /></label>
   <button type="button" disabled={importing||!importStart||!importEnd} onClick={()=>void runImport()}>{importing?"Importando…":"Importar planejamento para o site"}</button>
   {importNotice&&<p role="status">{importNotice}</p>}
  </div>
  <button type="button" disabled={!ready||printing||!hasMenu||menuLines.length>=600} onClick={()=>void print(true)}>Imprimir cardápio da semana</button>
  <details><summary>Prévia do cardápio da semana</summary><ThermalShoppingPreview lines={menuLines}/></details>

  {combined.errors.length>0&&<div className="adoce-cost-pending" role="alert"><strong>Planejamento incompleto · resolva antes de imprimir</strong><ul>{combined.errors.map(error=><li key={error}>{error}</li>)}</ul></div>}
  <h4>Selecionar itens das tortas</h4><label>Buscar item ou código<input type="search" value={search} onChange={event=>setSearch(event.target.value)} /></label>
  <div className="adoce-section-actions"><button disabled={!ready} type="button" onClick={()=>items.filter(item=>demand.quantities[item.id]>0).forEach(item=>change("selected",item.id,true))}>Selecionar necessários</button><button disabled={!ready} type="button" onClick={()=>items.filter(item=>demand.quantities[item.id]>0).forEach(item=>change("selected",item.id,false))}>Desmarcar necessários</button></div>
  <div className="adoce-shopping-flavors">{items.filter(item=>demand.quantities[item.id]>0&&`${item.name} ${item.internal_code}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))).map(item=><div key={item.id}><label><input disabled={!ready} type="checkbox" checked={selected[item.id]!==false} onChange={event=>change("selected",item.id,event.target.checked)} />{item.name}</label><small>Necessário: {displayShoppingQuantity(demand.quantities[item.id],item.consumption_unit)}</small>{stockField(item.id,item.consumption_unit)}</div>)}</div>
  {!Object.values(demand.quantities).some(value=>value>0)&&<p>Informe as tortas para ver somente os itens da composição.</p>}
  <h4>Itens extras</h4><label>Adicionar item extra<select disabled={!ready} value={extraId} onChange={event=>setExtraId(event.target.value)}><option value="">Escolha um item no menu</option>{items.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.name} · {item.internal_code}</option>)}</select></label>
  {items.filter(item=>item.id===extraId||extras[item.id]>0).map(item=><div className="adoce-shopping-extra" key={item.id}><strong>{item.name}{!item.active && " · produto excluído"}</strong><label>Quantidade extra ({item.consumption_unit==="unit"?"unidades":item.consumption_unit})<input disabled={!ready} type="number" min="0" step="any" inputMode="decimal" value={extras[item.id]||""} placeholder="0" onChange={event=>{const value=Number(event.target.value);if(Number.isFinite(value)&&value>=0)change("extras",item.id,value);}} /></label>{!demand.quantities[item.id]&&stockField(item.id,item.consumption_unit)}<button disabled={!ready} type="button" onClick={()=>{change("extras",item.id,0);setExtraId("");}}>Remover extra</button></div>)}
  <h4>Relatório de compras · {savedTotal} tortas</h4>{dirty&&<p className="adoce-cost-pending" role="status">Calculado a partir do último planejamento salvo, não do rascunho atual.</p>}<p>Pacotes completos arredondados para cima, conforme a embalagem de referência cadastrada; na ausência, usa a última compra.</p>
  <button type="button" disabled={!ready||printing||!rows.length||combined.errors.length>0||lines.length>=600} onClick={()=>void print()}>{printing?"Enviando…":"Imprimir lista de compras"}</button>
  {lines.length>=600 && <p role="alert">A lista excede o limite de impressão. Reduza a seleção para imprimir.</p>}
  {printNotice&&<p role="status">{printNotice}</p>}
  <div className="adoce-items-table-scroll"><table className="adoce-items-table"><thead><tr>{["Produto","Consumo previsto","Margem 20%","Necessidade ajustada","Estoque aproveitável","Comprar","Pacotes"].map(title=><th key={title}>{title}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.item.id}><td data-label="Produto">{row.item.name}</td><td data-label="Consumo previsto">{displayShoppingQuantity(row.required,row.item.consumption_unit)}</td><td data-label="Margem 20%">{displayShoppingQuantity(row.safetyMargin,row.item.consumption_unit)}</td><td data-label="Necessidade ajustada">{displayShoppingQuantity(row.adjustedRequired,row.item.consumption_unit)}</td><td data-label="Estoque aproveitável">{displayShoppingQuantity(row.stock,row.item.consumption_unit)}</td><td data-label="Comprar"><strong>{displayShoppingQuantity(row.buy,row.item.consumption_unit)}</strong></td><td data-label="Pacotes">{row.packages==null?"Embalagem não cadastrada":`${row.packages} ${row.packageName}`}</td></tr>)}</tbody></table></div>
  <details><summary>Prévia da lista térmica</summary><ThermalShoppingPreview lines={lines}/></details>
  </>}
  {active && createPortal(<div className="adoce-shopping-total" role="status" aria-live="polite"><strong>{total}</strong><span>tortas na semana</span></div>,document.body)}
 </section>;
}
