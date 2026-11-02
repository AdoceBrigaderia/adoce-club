import type {ProcurementItem} from "./shopping-procurement";
export type ShoppingWeek = {cakes:Record<string,number>;daily:Record<string,number>;extras:Record<string,number>;stock:Record<string,number>;selected:Record<string,boolean>;inCart?:Record<string,boolean>;quoteUnits?:Record<string,number>;quoteWeight?:Record<string,number>;quotePrice?:Record<string,number>;procurement?:Record<string,ProcurementItem>;requiredDays?:Record<string,boolean>;selectedFlavors?:Record<string,boolean>};
export const emptyShoppingWeek=():ShoppingWeek=>({cakes:{},daily:{},extras:{},stock:{},selected:{},selectedFlavors:{}});
export function localShoppingDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Fortaleza",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
export function shiftDate(date:string,days:number){const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);}
export function weekStart(date:string){const day=new Date(`${date}T12:00:00Z`).getUTCDay();return shiftDate(date,-((day+6)%7));}
export const weekDates=(start:string)=>Array.from({length:7},(_,index)=>shiftDate(start,index));
export function dayLabel(date:string){return new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC",weekday:"short",day:"2-digit",month:"2-digit"}).format(new Date(`${date}T12:00:00Z`));}
export const shortShoppingDate=(date:string)=>date.slice(8,10)+"/"+date.slice(5,7);
export function shoppingWeekLabel(start:string){
 const month=new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC",month:"long"}).format(new Date(`${start}T12:00:00Z`));
 const number=Math.floor((Number(start.slice(8,10))-1)/7)+1;
 return `${month[0].toLocaleUpperCase("pt-BR")+month.slice(1)} — semana ${number} · ${shortShoppingDate(start)} a ${shortShoppingDate(shiftDate(start,6))}`;
}
export function shoppingWeekOptions(selected:string){
 const first=shiftDate(weekStart(selected.slice(0,7)+"-01"),-28);
 return Array.from({length:62},(_,index)=>{
  const value=shiftDate(first,index*7);
  const month=new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC",month:"long",year:"numeric"}).format(new Date(`${value}T12:00:00Z`));
  return {value,label:shoppingWeekLabel(value),group:month[0].toLocaleUpperCase("pt-BR")+month.slice(1)};
 });
}
export function weeklyTotals(plan:ShoppingWeek,start:string){
 const totals={...plan.cakes};const dates=new Set(weekDates(start));
 for(const [key,value] of Object.entries(plan.daily)){const [date,flavor]=key.split("|");if(dates.has(date)&&Number.isSafeInteger(value)&&value>0)totals[flavor]=(totals[flavor]||0)+value;}
 return totals;
}
// Totais apenas dos dias escolhidos (ex.: comprar só para 1 ou 2 dias quando a
// verba está curta). Diferente de weeklyTotals, não soma plan.cakes (as
// quantidades "a distribuir" não pertencem a nenhum dia específico).
export function dailyTotals(plan:ShoppingWeek,dates:string[]){
 const totals:Record<string,number>={};const set=new Set(dates);
 for(const [key,value] of Object.entries(plan.daily)){const [date,flavor]=key.split("|");if(set.has(date)&&Number.isSafeInteger(value)&&value>0)totals[flavor]=(totals[flavor]||0)+value;}
 return totals;
}
export function applyDailyQuantity(plan:ShoppingWeek,date:string,flavor:string,value:number):ShoppingWeek{
 const key=`${date}|${flavor}`;const added=Math.max(0,value-(plan.daily[key]||0));
 return {...plan,daily:{...plan.daily,[key]:value},cakes:{...plan.cakes,[flavor]:Math.max(0,(plan.cakes[flavor]||0)-added)}};
}
// "requiredDays" precisa ser salvo antes de "daily": o servidor so aceita marcar
// sabor num dia que ja esteja marcado como obrigatorio (regra valida a partir de
// 26/10/2026). Se "daily" fosse enviado primeiro, o servidor rejeitaria a troca
// e a fila de salvamento travava para sempre nesse item, sem nunca chegar a
// enviar o "requiredDays" que destravaria a propria troca.
export const DRAFT_GROUPS=["requiredDays","cakes","daily","extras","stock","selected"] as const;
export function diffShoppingWeekDrafts(saved:ShoppingWeek,draft:ShoppingWeek){
 const changes:{group:typeof DRAFT_GROUPS[number];key:string;value:unknown}[]=[];
 for(const group of DRAFT_GROUPS){
  const draftGroup=(draft[group]||{}) as Record<string,unknown>;
  const savedGroup=(saved[group]||{}) as Record<string,unknown>;
  for(const [key,value] of Object.entries(draftGroup)){
   if(JSON.stringify(savedGroup[key])!==JSON.stringify(value))changes.push({group,key,value});
  }
 }
 return changes;
}
// Sabor fica visível na tabela de planejamento quando explicitamente marcado
// na nova seção "Selecionar sabores da semana". Sem marcação explícita (semana
// já planejada antes desta funcionalidade existir), o sabor com produção
// registrada continua visível, para não esconder dados já existentes.
export function isFlavorSelectedForWeek(plan:ShoppingWeek,flavorId:string,totals:Record<string,number>){
 const explicit=plan.selectedFlavors?.[flavorId];
 if(explicit!==undefined)return explicit;
 return (totals[flavorId]||0)>0;
}
export function requiredDayWarnings(plan:ShoppingWeek,start:string,flavors:{id:string}[],batterColors:Record<string,string|null>){
 const warnings:{date:string;flavorCount:number;whiteCount:number}[]=[];
 for(const date of weekDates(start)){
  if(!plan.requiredDays?.[date])continue;
  const dayFlavors=flavors.filter(flavor=>plan.daily[`${date}|${flavor.id}`]>0);
  const whiteCount=dayFlavors.filter(flavor=>batterColors[flavor.id]==="Branca").length;
  if(dayFlavors.length<6||whiteCount*3<dayFlavors.length)warnings.push({date,flavorCount:dayFlavors.length,whiteCount});
 }
 return warnings;
}
export function weeklyMenuReceipt(start:string,plan:ShoppingWeek,flavors:{id:string;name:string}[]){
 const lines=["CARDÁPIO DA SEMANA",`${shortShoppingDate(start)} a ${shortShoppingDate(shiftDate(start,6))}`,"--------------------------------"];
 for(const date of weekDates(start)){
  const names=flavors.filter(flavor=>plan.daily[`${date}|${flavor.id}`]>0).map(flavor=>flavor.name).sort((a,b)=>a.localeCompare(b,"pt-BR"));
  if(!names.length)continue;
  lines.push(dayLabel(date).toLocaleUpperCase("pt-BR"),...names,"--------------------------------");
 }
 return lines.flatMap(line=>line.match(/.{1,32}/gu)||[""]);
}
