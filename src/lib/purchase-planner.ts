export type PlanItem = { id:string; name:string; internal_code:string; item_kind:string; consumption_unit:string; active:boolean; reference_quantity:number|null; reference_unit:string|null; reference_package_name:string|null };
export type PlanVersion = { id:string; recipe_id:string; version_number:number; yield_quantity:number|null; yield_unit:string|null; size_code:string|null };
export type PlanComponent = { recipe_version_id:string; component_kind:string; item_id:string|null; child_recipe_version_id:string|null; quantity:number|null; unit:string; placement?:string };
export type PlanRecipe = { id:string; name:string; flavor_id:string|null; active:boolean; batter_color?:string|null };
export type PlanWorkspace = { items:PlanItem[]; recipes:PlanRecipe[]; versions:PlanVersion[]; components:PlanComponent[] };
export const BATTER_COLORS = ["Branca","Chocolate","Black","Red","Outra"] as const;
export type BatterColor = typeof BATTER_COLORS[number];
export function predominantBatterColor(flavorId:string, workspace:PlanWorkspace):string|null {
 const recipe=workspace.recipes.find(r=>r.flavor_id===flavorId&&r.active);
 if(!recipe)return null;
 const versions=workspace.versions.filter(v=>v.recipe_id===recipe.id);
 if(!versions.length)return null;
 const version=versions.reduce((latest,current)=>current.version_number>latest.version_number?current:latest);
 const discs=workspace.components.filter(c=>c.recipe_version_id===version.id&&c.component_kind==="recipe_version"&&c.placement==="Discos de bolo"&&c.child_recipe_version_id);
 const counts=new Map<string,number>();
 for(const disc of discs){
  const childVersion=workspace.versions.find(v=>v.id===disc.child_recipe_version_id);
  if(!childVersion)continue;
  const childRecipe=workspace.recipes.find(r=>r.id===childVersion.recipe_id);
  const color=childRecipe?.batter_color;
  if(!color)continue;
  counts.set(color,(counts.get(color)||0)+1);
 }
 let predominant:string|null=null,max=0;
 for(const[color,count]of counts){if(count>max){max=count;predominant=color;}}
 return predominant;
}
export type PlanPurchase = { item_id:string; brand_name:string; package_layers:{name:string; quantity:string}[]; normalized_quantity:number; normalized_unit:string; outer_unit_price:number|null; gross_total:number; net_total:number };
export type PlanInvoice = { issued_on:string; created_at:string; supplier_name?:string; lines:PlanPurchase[] };
export function physicalUnit(unit:string):{dimension:string;factor:number}|null {
 return ({g:{dimension:"mass",factor:1},kg:{dimension:"mass",factor:1000},ml:{dimension:"volume",factor:1},l:{dimension:"volume",factor:1000},unit:{dimension:"count",factor:1}} as Record<string,{dimension:string;factor:number}>)[unit]||null;
}
export function convertQuantity(quantity:number,from:string,to:string):number|null{
 const a=physicalUnit(from),b=physicalUnit(to);return a&&b&&a.dimension===b.dimension?quantity*a.factor/b.factor:null;
}
export function planDemand(workspace:PlanWorkspace,cakes:Record<string,number>,extras:Record<string,number>={}):{quantities:Record<string,number>; errors:string[]}{
 const quantities:Record<string,number>={};const errors=new Set<string>();
 const items=new Map(workspace.items.map(i=>[i.id,i]));const versions=new Map(workspace.versions.map(v=>[v.id,v]));
 const recipes=new Map(workspace.recipes.map(r=>[r.id,r]));
 const visit=(version:PlanVersion,multiplier:number,path:Set<string>)=>{
  const recipe=recipes.get(version.recipe_id);const label=recipe?.name||"Preparação";
  if(path.has(version.id)){errors.add(label+": dependência circular");return;}
  const nextPath=new Set(path).add(version.id);
  const components=workspace.components.filter(c=>c.recipe_version_id===version.id);
  if(!components.length){errors.add(label+": ficha sem componentes");return;}
  for(const component of components){
   const q=Number(component.quantity);if(!Number.isFinite(q)||q<=0){errors.add(label+": componente sem quantidade");continue;}
   if(component.component_kind==="item"){
    const item=items.get(component.item_id||"");
    if(!item){errors.add(label+": insumo não encontrado");continue;}
    if(!item.active)errors.add(item.name+": produto excluído; restaure ou substitua na ficha");
    const amount=convertQuantity(q,component.unit,item.consumption_unit);
    if(amount==null){errors.add(item.name+": unidade incompatível na ficha");continue;}
    quantities[item.id]=(quantities[item.id]||0)+amount*multiplier;
   }else{
    const child=versions.get(component.child_recipe_version_id||"");
    if(!child||!child.yield_quantity||!child.yield_unit){errors.add(label+": preparação sem rendimento");continue;}
    const amount=convertQuantity(q,component.unit,child.yield_unit);
    if(amount==null){errors.add(label+": unidade incompatível com o rendimento da preparação");continue;}
    visit(child,multiplier*amount/child.yield_quantity,nextPath);
   }
  }
 };
 for(const [flavorId,count] of Object.entries(cakes)){
  if(!Number.isFinite(count)||count<0||!Number.isInteger(count)){errors.add("Informe quantidades inteiras de tortas");continue;}if(!count)continue;
  const recipe=workspace.recipes.find(r=>r.flavor_id===flavorId&&r.active);
  const version=recipe&&workspace.versions.filter(v=>v.recipe_id===recipe.id&&v.size_code==="G").sort((a,b)=>b.version_number-a.version_number)[0];
  if(!version){errors.add((recipe?.name||"Sabor selecionado")+": sem ficha G cadastrada");continue;}
  // A final sheet describes one entire cake; its slice yield is not a divisor.
  visit(version,count,new Set());
 }
 for(const [id,q] of Object.entries(extras)){
  if(!items.has(id)){errors.add("Compra extra com item inexistente");continue;}
  if(!Number.isFinite(q)||q<0){errors.add(items.get(id)!.name+": quantidade extra inválida");continue;}
  if(q>0&&!items.get(id)!.active)errors.add(items.get(id)!.name+": produto excluído; remova o extra ou restaure o cadastro");
  quantities[id]=(quantities[id]||0)+q;
 }
 for(const id of Object.keys(quantities))quantities[id]=Math.round(quantities[id]*1e6)/1e6;
 return {quantities,errors:[...errors]};
}
export function purchaseReference(item:PlanItem,required:number,invoices:PlanInvoice[]){
 const last=invoices.flatMap(invoice=>invoice.lines.filter(l=>l.item_id===item.id).map(line=>({...line,date:invoice.issued_on,created:invoice.created_at,supplier:invoice.supplier_name||""}))).sort((a,b)=>b.date.localeCompare(a.date)||b.created.localeCompare(a.created))[0]||null;
 const ref=item.reference_quantity&&item.reference_unit?convertQuantity(item.reference_quantity,item.reference_unit,item.consumption_unit):null;
 const outer=Number(last?.package_layers[0]?.quantity||0);
 const normalized=last?convertQuantity(Number(last.normalized_quantity),last.normalized_unit,item.consumption_unit):null;
 const perPackage=normalized&&outer>0?normalized/outer:null;
 const packages=perPackage&&required>0?Math.ceil(required/perPackage-1e-10):0;
 return {last,equivalent:ref?required/ref:null,perPackage,packages,unitPrice:last?(last.outer_unit_price??last.gross_total/outer):null};
}

export function shoppingQuantity(item:PlanItem,required:number,stock:number,invoices:PlanInvoice[]) {
 const safetyMargin=Math.round(required*.2*1e6)/1e6;
 const adjustedRequired=Math.round((required+safetyMargin)*1e6)/1e6;
 const buy=Math.max(0,Math.round((adjustedRequired-stock)*1e6)/1e6);
 const reference=purchaseReference(item,buy,invoices);
 const size=item.reference_quantity&&item.reference_unit?convertQuantity(item.reference_quantity,item.reference_unit,item.consumption_unit):null;
 const perPackage=size||reference.perPackage;
 const measure=physicalUnit(item.consumption_unit)?.dimension==="mass"?"kg":physicalUnit(item.consumption_unit)?.dimension==="volume"?"l":"un";
 const last=reference.last;
 const normalized=last?convertQuantity(Number(last.normalized_quantity),last.normalized_unit,measure==="un"?"unit":measure):null;
 const outer=Number(last?.package_layers[0]?.quantity||0);
 const lastPrice=last&&normalized&&normalized>0&&Number.isFinite(Number(last.net_total))&&last.net_total>=0?{
  perMeasure:Number(last.net_total)/normalized,measure,
  perPackage:outer>0?Number(last.net_total)/outer:null,
  packageName:last.package_layers[0]?.name||"embalagem",
  packageQuantity:reference.perPackage,date:last.date,
 }:null;
 return {required,safetyMargin,adjustedRequired,stock,buy,lastPrice,packages:perPackage?Math.max(0,Math.ceil(buy/perPackage-1e-10)):null,packageName:size?item.reference_package_name||"pacote":reference.last?.package_layers[0]?.name||"pacote"};
}
export function displayShoppingQuantity(value:number,unit:string) {
 const amount=unit==="g"||unit==="ml"?value/1000:value;
 return `${amount.toLocaleString("pt-BR",{maximumFractionDigits:3})} ${unit==="g"?"kg":unit==="ml"?"l":unit==="unit"?"un":unit}`;
}
export function itemEstimatedTotal(row:{item:PlanItem}&ReturnType<typeof shoppingQuantity>):number|null {
 if(!row.lastPrice||!row.buy)return row.lastPrice?0:null;
 const buyInMeasure=row.item.consumption_unit==="g"||row.item.consumption_unit==="ml"?row.buy/1000:row.buy;
 return buyInMeasure*row.lastPrice.perMeasure;
}
export function shoppingGrandTotal(rows:({item:PlanItem}&ReturnType<typeof shoppingQuantity>)[]):number {
 return rows.reduce((sum,row)=>sum+(itemEstimatedTotal(row)||0),0);
}
export function shoppingReceipt(total:number,rows:({item:PlanItem}&ReturnType<typeof shoppingQuantity>)[]) {
 const lines=["LISTA DE COMPRAS",`Total: ${total} tortas`,"--------------------------------"];
 const money=(value:number)=>`R$ ${value.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
 const plural:Record<string,string>={pacote:"pacotes",caixa:"caixas",embalagem:"embalagens",saco:"sacos",bandeja:"bandejas",unidade:"unidades"};
 for(const row of rows) {
  const packageLabel=row.packages===1?row.packageName:plural[row.packageName.toLowerCase()]||row.packageName;
  const packages=row.packages==null?"pacotes pendentes":`${row.packages} ${packageLabel}`;
  lines.push(`[ ] ${row.item.name}`,`Previsto: ${displayShoppingQuantity(row.required,row.item.consumption_unit)}`,`Margem 20%: ${displayShoppingQuantity(row.safetyMargin,row.item.consumption_unit)}`,`Estoque: ${displayShoppingQuantity(row.stock,row.item.consumption_unit)}`,`Comprar: ${displayShoppingQuantity(row.buy,row.item.consumption_unit)} / ${packages}`);
  const price=row.lastPrice;
  if(price){
   lines.push(`${money(price.perMeasure)}/${price.measure}${price.perPackage!=null?` | ${money(price.perPackage)}/${price.packageName}`:""}`);
   const plannedPackage=row.item.reference_quantity&&row.item.reference_unit?convertQuantity(row.item.reference_quantity,row.item.reference_unit,row.item.consumption_unit):price.packageQuantity;
   if(price.packageQuantity&&price.packageQuantity!==plannedPackage)lines.push(`Emb. última compra: ${displayShoppingQuantity(price.packageQuantity,row.item.consumption_unit)}`);
   if(price.perPackage==null)lines.push("Preço/embalagem: não cadastrado");
   const itemTotal=itemEstimatedTotal(row);
   if(itemTotal!=null)lines.push(`Estimado: ${money(itemTotal)}`);
  }else lines.push("Preço: não cadastrado");
  lines.push("--------------------------------");
 }
 lines.push(`TOTAL ESTIMADO: ${money(shoppingGrandTotal(rows))}`,"--------------------------------");
 return lines.flatMap(line=>line.match(/.{1,32}/gu)||[""]);
}
export function compositionUsage(workspace:PlanWorkspace) {
 type Usage={cakes:string[];used:boolean};
 const items:Record<string,Usage>=Object.fromEntries(workspace.items.map(item=>[item.id,{cakes:[],used:false}]));
 const preparations:Record<string,Usage>=Object.fromEntries(workspace.recipes.map(recipe=>[recipe.id,{cakes:[],used:false}]));
 const versions=new Map(workspace.versions.map(version=>[version.id,version]));
 const current=workspace.versions.filter(version=>workspace.recipes.some(recipe=>recipe.id===version.recipe_id&&recipe.active)&&!workspace.versions.some(other=>other.recipe_id===version.recipe_id&&other.size_code===version.size_code&&other.version_number>version.version_number));
 const visit=(id:string,cake:string|null,path:Set<string>)=>{
  if(path.has(id))return;
  const next=new Set(path).add(id);
  for(const row of workspace.components.filter(component=>component.recipe_version_id===id)) {
   const child=versions.get(row.child_recipe_version_id||"");
   const usage=row.component_kind==="item"?items[row.item_id||""]:child?preparations[child.recipe_id]:null;
   if(usage){usage.used=true;if(cake&&!usage.cakes.includes(cake))usage.cakes.push(cake);}
   if(row.component_kind!=="item"&&child)visit(child.id,cake,next);
  }
 };
 for(const version of current){const recipe=workspace.recipes.find(recipe=>recipe.id===version.recipe_id)!;visit(version.id,recipe.flavor_id?recipe.name:null,new Set());}
 for(const usage of [...Object.values(items),...Object.values(preparations)])usage.cakes.sort((a,b)=>a.localeCompare(b,"pt-BR"));
 return {items,preparations};
}
