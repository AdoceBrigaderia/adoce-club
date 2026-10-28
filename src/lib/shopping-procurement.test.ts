import {describe,expect,it} from "vitest";
import {budgetCsv,budgetText,compareInvoicePurchase,importBudgetResponse,procurementSummary,purchaseCompletion,recommendOffers,sortShoppingRows,type ProcurementItem} from "./shopping-procurement";

const item=(change:Partial<ProcurementItem>={}):ProcurementItem=>({offers:[],purchases:[],...change});

describe("compras e cotações",()=>{
 it("permite concluir com um toque quando nenhum detalhe foi informado",()=>{
  expect(purchaseCompletion(item(),1400)).toEqual({state:"unrecorded",missing:0});
 });
 it("mantém somente o restante pendente quando a compra informada foi parcial",()=>{
  expect(purchaseCompletion(item({purchases:[{id:"1",supplierId:"",packages:1,contentPerPackage:900,totalPrice:0}]}),1400)).toEqual({state:"partial",missing:500});
 });
 it("considera concluído quando a quantidade opcional alcança o sugerido",()=>{
  expect(purchaseCompletion(item({purchases:[{id:"1",supplierId:"",packages:2,contentPerPackage:700,totalPrice:0}]}),1400)).toEqual({state:"complete",missing:0});
 });
 it("permite concluir quando a necessidade sugerida é zero",()=>{
  expect(purchaseCompletion(item({purchases:[{id:"1",supplierId:"",packages:10,contentPerPackage:1000,totalPrice:36.9}]}),0)).toEqual({state:"complete",missing:0});
 });
 it("mantém pendentes antes dos comprados",()=>{
  const rows=[{item:{id:"b",name:"Comprado"}},{item:{id:"a",name:"Falta"}}];
  expect(sortShoppingRows(rows,{b:item({purchased:true})}).map(row=>row.item.name)).toEqual(["Falta","Comprado"]);
 });
 it("soma várias embalagens e informa insuficiência",()=>{
  const summary=procurementSummary(item({purchases:[
   {id:"1",supplierId:"s",packages:2,contentPerPackage:500,totalPrice:20},
   {id:"2",supplierId:"s",packages:1,contentPerPackage:250,totalPrice:6},
  ]}),1400);
  expect(summary.purchased).toBe(1250);expect(summary.missing).toBe(150);expect(summary.sufficient).toBe(false);
 });
 it("recomenda menor preço comparável por item",()=>{
  const result=recommendOffers(item({offers:[
   {id:"1",supplierId:"caro",packages:2,contentPerPackage:500,totalPrice:30},
   {id:"2",supplierId:"barato",packages:2,contentPerPackage:500,totalPrice:20},
  ]}),800);
  expect(result?.supplierId).toBe("barato");expect(result?.estimatedTotal).toBe(20);
 });
 it("usa plural correto no pedido",()=>{
  const rows=[{name:"Leite condensado",buy:1000,unit:"g",packages:10,packageName:"PACOTE"},{name:"Creme",buy:200,unit:"g",packages:1,packageName:"caixa"}];
  expect(budgetText("13/10/2026",rows)).toContain("10 PACOTES");
  expect(budgetText("13/10/2026",rows)).toContain("1 caixa");
  expect(budgetCsv(rows)).toContain('"Leite condensado";"10 PACOTES"');
 });
 it("importa resposta exportável do fornecedor",()=>{
  const parsed=importBudgetResponse('item;fornecedor;embalagens;conteudo_por_embalagem;valor_total\n"Leite";"Fornecedor A";2;395;15,90');
  expect(parsed.errors).toEqual([]);expect(parsed.rows[0]).toMatchObject({item:"Leite",supplier:"Fornecedor A",packages:2,contentPerPackage:395,totalPrice:15.9});
 });
 it("compara nota com quantidade e valor combinados",()=>{
  expect(compareInvoicePurchase({normalizedQuantity:900,grossTotal:25},item({purchases:[{id:"1",supplierId:"s",packages:2,contentPerPackage:500,totalPrice:20}]}))).toEqual({quantityDifference:-100,priceDifference:5,matches:false});
 });
});
