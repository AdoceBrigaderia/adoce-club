export type PackageEntry={id:string;supplierId:string;packages:number;contentPerPackage:number;totalPrice:number};
export type ProcurementItem={purchased?:boolean;offers:PackageEntry[];purchases:PackageEntry[]};

const valid=(entry:PackageEntry)=>Number.isFinite(entry.packages)&&entry.packages>0&&Number.isFinite(entry.contentPerPackage)&&entry.contentPerPackage>0&&Number.isFinite(entry.totalPrice)&&entry.totalPrice>=0;
export function procurementSummary(state:ProcurementItem|undefined,required:number){
 const entries=(state?.purchases||[]).filter(valid);const purchased=entries.reduce((sum,e)=>sum+e.packages*e.contentPerPackage,0);const total=entries.reduce((sum,e)=>sum+e.totalPrice,0);
 return {purchased,total,missing:Math.max(0,required-purchased),surplus:Math.max(0,purchased-required),sufficient:purchased>=required&&required>0};
}
export function purchaseCompletion(state:ProcurementItem|undefined,required:number){
 const summary=procurementSummary(state,required);
 if(!(state?.purchases||[]).some(valid))return {state:"unrecorded" as const,missing:0};
 return summary.sufficient?{state:"complete" as const,missing:0}:{state:"partial" as const,missing:summary.missing};
}
export function sortShoppingRows<T extends {item:{id:string;name:string}}>(rows:T[],states:Record<string,ProcurementItem|undefined>){
 return [...rows].sort((a,b)=>Number(Boolean(states[a.item.id]?.purchased))-Number(Boolean(states[b.item.id]?.purchased))||a.item.name.localeCompare(b.item.name,"pt-BR"));
}
export function recommendOffers(state:ProcurementItem|undefined,required:number){
 const candidates=(state?.offers||[]).filter(valid).map(entry=>{const content=entry.packages*entry.contentPerPackage;const packages=Math.ceil(required/entry.contentPerPackage);return {...entry,content,unitPrice:entry.totalPrice/content,packagesNeeded:packages,estimatedTotal:entry.totalPrice/entry.packages*packages};});
 return candidates.sort((a,b)=>a.unitPrice-b.unitPrice)[0]||null;
}
const plural=(name:string,count:number)=>{if(count===1)return name;const lower=name.toLocaleLowerCase("pt-BR"),result=lower.endsWith("ão")?lower.slice(0,-2)+"ões":lower.endsWith("m")?lower.slice(0,-1)+"ns":lower.endsWith("r")||lower.endsWith("z")?lower+"es":lower+"s";return name===name.toLocaleUpperCase("pt-BR")?result.toLocaleUpperCase("pt-BR"):result;};
type BudgetRow={name:string;buy:number;unit:string;packages:number|null;packageName:string};
export function budgetText(date:string,rows:BudgetRow[]){return [`PEDIDO DE ORÇAMENTO · ${date}`,"Informe fornecedor, embalagem e valor total.","",...rows.map(r=>`- ${r.name}: ${r.packages==null?`${r.buy.toLocaleString("pt-BR")} ${r.unit}`:`${r.packages} ${plural(r.packageName,r.packages)}`} | Fornecedor: ______ | Valor total: R$ ______`)].join("\n");}
const q=(value:string)=>`"${value.replaceAll('"','""')}"`;
export function budgetCsv(rows:BudgetRow[]){return "\ufeff"+["item;quantidade_pedida;fornecedor;embalagens;conteudo_por_embalagem;valor_total",...rows.map(r=>[q(r.name),q(r.packages==null?`${r.buy} ${r.unit}`:`${r.packages} ${plural(r.packageName,r.packages)}`),"","","",""].join(";"))].join("\r\n");}
export function importBudgetResponse(text:string){
 const lines=text.replace(/^\ufeff/,"").split(/\r?\n/).filter(Boolean);const rows:{item:string;supplier:string;packages:number;contentPerPackage:number;totalPrice:number}[]=[];const errors:string[]=[];
 const cell=(value:string)=>value.trim().replace(/^"|"$/g,"").replaceAll('""','"');const header=(lines[0]||"").split(";").map(cell);const at=(cells:string[],name:string)=>cells[header.indexOf(name)];
 for(let i=1;i<lines.length;i++){const cells=lines[i].split(";").map(cell);const item=at(cells,"item"),supplier=at(cells,"fornecedor"),packages=at(cells,"embalagens"),content=at(cells,"conteudo_por_embalagem"),total=at(cells,"valor_total");const row={item,supplier,packages:Number(packages?.replace(",",".")),contentPerPackage:Number(content?.replace(",",".")),totalPrice:Number(total?.replace(",","."))};if(!item||!supplier||!(row.packages>0)||!(row.contentPerPackage>0)||!(row.totalPrice>=0))errors.push(`Linha ${i+1}: confira item, fornecedor, embalagens, conteúdo e valor.`);else rows.push(row);}
 return {rows,errors};
}
export function compareInvoicePurchase(invoice:{normalizedQuantity:number;grossTotal:number},state:ProcurementItem|undefined){const expected=procurementSummary(state,0);const quantityDifference=invoice.normalizedQuantity-expected.purchased,priceDifference=invoice.grossTotal-expected.total;return {quantityDifference,priceDifference,matches:Math.abs(quantityDifference)<.000001&&Math.abs(priceDifference)<.01};}
