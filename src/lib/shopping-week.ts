export type ShoppingWeek = {cakes:Record<string,number>;daily:Record<string,number>;extras:Record<string,number>;stock:Record<string,number>;selected:Record<string,boolean>;inCart?:Record<string,boolean>;quoteUnits?:Record<string,number>;quoteWeight?:Record<string,number>;quotePrice?:Record<string,number>};
export const emptyShoppingWeek=():ShoppingWeek=>({cakes:{},daily:{},extras:{},stock:{},selected:{}});
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
export function applyDailyQuantity(plan:ShoppingWeek,date:string,flavor:string,value:number):ShoppingWeek{
 const key=`${date}|${flavor}`;const added=Math.max(0,value-(plan.daily[key]||0));
 return {...plan,daily:{...plan.daily,[key]:value},cakes:{...plan.cakes,[flavor]:Math.max(0,(plan.cakes[flavor]||0)-added)}};
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
