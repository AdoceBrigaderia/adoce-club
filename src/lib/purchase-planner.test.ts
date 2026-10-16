import { describe,it,expect } from "vitest";
import {planDemand,purchaseReference, shoppingQuantity, compositionUsage, shoppingReceipt, type PlanWorkspace} from "./purchase-planner";
const item={id:"sugar",name:"Açúcar",internal_code:"INS1",item_kind:"ingredient",consumption_unit:"g",active:true,reference_quantity:1000,reference_unit:"g",reference_package_name:"pacote"};
const workspace:PlanWorkspace={items:[item],recipes:[{id:"cake",name:"Torta",flavor_id:"flavor",active:true},{id:"mass",name:"Massa",flavor_id:null,active:true}],versions:[{id:"cake-v",recipe_id:"cake",version_number:1,size_code:"G",yield_quantity:13,yield_unit:"slice"},{id:"mass-v",recipe_id:"mass",version_number:1,size_code:null,yield_quantity:650,yield_unit:"g"}],components:[{recipe_version_id:"cake-v",component_kind:"recipe_version",item_id:null,child_recipe_version_id:"mass-v",quantity:1950,unit:"g"},{recipe_version_id:"cake-v",component_kind:"item",item_id:"sugar",child_recipe_version_id:null,quantity:50,unit:"g"},{recipe_version_id:"mass-v",component_kind:"item",item_id:"sugar",child_recipe_version_id:null,quantity:150,unit:"g"}]};
describe("planejamento de compras",()=>{
 it("avisa quando um extra planejado foi excluído, mas aceita removê-lo",()=>{
  const archived={...workspace,items:[{...item,active:false}]};
  expect(planDemand(archived,{}, {sugar:100}).errors.join(" ")).toContain("produto excluído");
  expect(planDemand(archived,{}, {sugar:0}).errors).toEqual([]);
 });
 it("desconta estoque antes de arredondar pacotes e não gera compra negativa",()=>{
  expect(shoppingQuantity(item,2500,700,[])).toMatchObject({buy:2300,packages:3,stock:700});
  expect(shoppingQuantity(item,500,700,[])).toMatchObject({buy:0,packages:0});
 });
 it("aplica 20% de segurança uma vez antes de descontar o estoque",()=>{
  expect(shoppingQuantity(item,10000,3000,[])).toMatchObject({required:10000,safetyMargin:2000,adjustedRequired:12000,stock:3000,buy:9000,packages:9});
 });
 it("encontra uso indireto e ignora versões antigas fora da composição atual",()=>{
  expect(compositionUsage(workspace).items.sugar.cakes).toEqual(["Torta"]);
  const revised={...workspace,versions:[...workspace.versions,{...workspace.versions[0],id:"new",version_number:2}],components:[...workspace.components,{...workspace.components[1],recipe_version_id:"new"}]};
  expect(compositionUsage(revised).preparations.mass.cakes).toEqual([]);
 });
 it("imprime total de tortas, estoque e compra sem fórmulas",()=>{
  const lines=shoppingReceipt(3,[{item,...shoppingQuantity(item,2500,700,[])}]);
  expect(lines.join("\n")).toContain("Total: 3 tortas");
  expect(lines.join("\n")).toContain("Previsto: 2,5 kg");
  expect(lines.join("\n")).toContain("Margem 20%: 0,5 kg");
  expect(lines.join("\n")).toContain("Comprar: 2,3 kg");
  expect(lines.join("\n")).toContain("Estoque: 0,7 kg");
  expect(lines.join("\n")).toContain("3 pacote");
  expect(lines.every(line=>line.length<=32)).toBe(true);
 });
 it("mostra último preço por kg e pela embalagem realmente comprada, mesmo com referência diferente",()=>{
  const invoices=[{issued_on:"2026-10-10",created_at:"2026-10-10",lines:[{item_id:"sugar",brand_name:"",package_layers:[{name:"caixa",quantity:"2"}],normalized_quantity:10,normalized_unit:"kg",outer_unit_price:100,gross_total:200,net_total:180}]}];
  const row={item,...shoppingQuantity(item,2500,700,invoices)};
  expect(row.lastPrice).toMatchObject({perMeasure:18,measure:"kg",perPackage:90,packageName:"caixa",packageQuantity:5000});
  const text=shoppingReceipt(5,[row]).join("\n");
  expect(text).toContain("R$ 18,00/kg");
  expect(text).toContain("R$ 90,00/caixa");
  expect(text).toContain("Emb. última compra: 5 kg");
  expect(text).not.toContain("10/10/2026");
  expect(text).not.toContain("Última compra:");
  expect(shoppingReceipt(5,[row]).every(line=>line.length<=32)).toBe(true);
 });
 it("não inventa preços nem converte unidades em kg",()=>{
  expect(shoppingQuantity(item,1,0,[]).lastPrice).toBeNull();
  const packaging={...item,consumption_unit:"unit",reference_unit:"unit"};
  const row={item:packaging,...shoppingQuantity(packaging,13,0,[{issued_on:"2026-10-10",created_at:"2026-10-10",lines:[{item_id:"sugar",brand_name:"",package_layers:[{name:"pacote",quantity:"2"}],normalized_quantity:100,normalized_unit:"unit",outer_unit_price:10,gross_total:20,net_total:20}]}])};
  expect(row.lastPrice).toMatchObject({perMeasure:0.2,measure:"un",perPackage:10});
 });
 it("planeja 26 unidades de calda para duas tortas, usando 26/22 da receita",()=>{
  const plan={...workspace,recipes:[...workspace.recipes,{id:"calda",name:"Calda",flavor_id:null,active:true}],versions:[...workspace.versions,{id:"calda-v",recipe_id:"calda",version_number:1,yield_quantity:22,yield_unit:"unit",size_code:null}],components:[{recipe_version_id:"cake-v",component_kind:"recipe_version",item_id:null,child_recipe_version_id:"calda-v",quantity:13,unit:"unit"},{recipe_version_id:"calda-v",component_kind:"item",item_id:"sugar",child_recipe_version_id:null,quantity:220,unit:"g"}]};
  expect(planDemand(plan,{flavor:2}).quantities.sugar).toBe(260);
 });
 it("inclui 13 descartáveis por torta, sem multiplicar novamente pelas fatias",()=>{
  const packaging={...item,id:"box",name:"Embalagem",item_kind:"packaging",consumption_unit:"unit"};
  const plan={...workspace,items:[...workspace.items,packaging],components:[...workspace.components,{recipe_version_id:"cake-v",component_kind:"item",item_id:"box",child_recipe_version_id:null,quantity:13,unit:"unit"}]};
  expect(planDemand(plan,{flavor:2}).quantities.box).toBe(26);
 });
 it("expande três discos por torta, agrega ingredientes e extras sem dividir pelas 13 fatias",()=>expect(planDemand(workspace,{flavor:2},{sugar:100})).toEqual({quantities:{sugar:1100},errors:[]}));
 it("não inventa demanda para um sabor sem ficha G",()=>expect(planDemand(workspace,{missing:1}).errors[0]).toContain("sem ficha G"));
 it("sinaliza um componente de volume usando um insumo de massa",()=>expect(planDemand({...workspace,components:[{...workspace.components[1],unit:"ml"}]},{flavor:1}).errors[0]).toContain("incompatível"));
 it("respeita o rendimento de uma preparação contada por unidade",()=>expect(planDemand({...workspace,versions:[workspace.versions[0],{...workspace.versions[1],yield_quantity:1,yield_unit:"unit"}],components:[{...workspace.components[0],quantity:2,unit:"unit"},workspace.components[2]]},{flavor:1}).quantities.sugar).toBe(300));
 it("converte uma última compra por caixa e arredonda embalagens completas",()=>{
  const reference=purchaseReference(item,5400,[{issued_on:"2026-09-26",created_at:"2026-09-26",lines:[{item_id:"sugar",brand_name:"Marca",package_layers:[{name:"caixa",quantity:"2"},{name:"pacote",quantity:"5"}],normalized_quantity:10,normalized_unit:"kg",outer_unit_price:100,gross_total:200,net_total:200}]}]);
  expect(reference.equivalent).toBe(5.4);expect(reference.perPackage).toBe(5000);expect(reference.packages).toBe(2);expect(reference.unitPrice).toBe(100);
 });
 it("aceita quantidade exatamente múltipla sem uma caixa extra",()=>expect(purchaseReference(item,1000,[{issued_on:"2026-09-26",created_at:"2026-09-26",lines:[{item_id:"sugar",brand_name:"",package_layers:[{name:"pacote",quantity:"1"}],normalized_quantity:1000,normalized_unit:"g",outer_unit_price:25,gross_total:25,net_total:25}]}]).packages).toBe(1));
});
