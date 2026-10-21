import {describe,it,expect} from "vitest";
import {weekStart,weekDates,shiftDate,weeklyTotals,applyDailyQuantity,weeklyMenuReceipt,requiredDayWarnings,emptyShoppingWeek,shoppingWeekLabel,shoppingWeekOptions} from "./shopping-week";
describe("planejamento diário de tortas",()=>{
 it("identifica semanas completas pelo mês da segunda-feira, sem repetir datas",()=>{
  expect(shoppingWeekLabel("2026-10-05")).toBe("Outubro — semana 1 · 05/10 a 11/10");
  expect(shoppingWeekLabel("2026-10-12")).toBe("Outubro — semana 2 · 12/10 a 18/10");
  expect(shoppingWeekLabel("2026-12-28")).toBe("Dezembro — semana 4 · 28/12 a 03/01");
  const options=shoppingWeekOptions("2026-10-05");
  expect(options.some(option=>option.value==="2026-10-05")).toBe(true);
  expect(new Set(options.map(option=>option.value)).size).toBe(options.length);
  expect(options.every(option=>weekStart(option.value)===option.value)).toBe(true);
 });
 it("usa segunda a domingo inclusive nas mudanças de mês e ano",()=>{
  expect(weekStart("2026-10-11")).toBe("2026-10-05");
  expect(weekDates("2026-12-28")).toEqual(["2026-12-28","2026-12-29","2026-12-30","2026-12-31","2027-01-01","2027-01-02","2027-01-03"]);
  expect(shiftDate("2026-12-28",7)).toBe("2027-01-04");
 });
 it("soma dias sem misturar outra semana e distribui quantidades antigas sem duplicar",()=>{
  const plan={...emptyShoppingWeek(),cakes:{f:5},daily:{"2026-10-12|f":0,"2026-10-19|f":20}};
  const first=applyDailyQuantity(plan,"2026-10-12","f",3);
  expect(first.cakes.f).toBe(2);
  expect(weeklyTotals(first,"2026-10-12")).toEqual({f:5});
  const second=applyDailyQuantity(first,"2026-10-13","f",4);
  expect(weeklyTotals(second,"2026-10-12")).toEqual({f:7});
  expect(weeklyTotals(applyDailyQuantity(second,"2026-10-13","f",1),"2026-10-12")).toEqual({f:4});
 });
 it("imprime cardápio por dia sem expor estoque ou quantidades de produção",()=>{
  const plan={...emptyShoppingWeek(),daily:{"2026-10-12|f":3,"2026-10-13|g":1}};
  const lines=weeklyMenuReceipt("2026-10-12",plan,[{id:"f",name:"Chocolate"},{id:"g",name:"Morango"}]);
  expect(lines.join("\n")).toContain("12/10 a 18/10");
  expect(lines.join("\n")).toContain("Chocolate");
  expect(lines.join("\n")).toContain("Morango");
  expect(lines.join("\n")).not.toContain("Estoque");
  expect(lines.every(line=>line.length<=32)).toBe(true);
 });
 it("avisa quando um dia obrigatório não tem 6 sabores ou 1/3 de massa branca",()=>{
  const flavors=[{id:"a"},{id:"b"},{id:"c"},{id:"d"},{id:"e"},{id:"f"},{id:"g"}];
  const batterColors={a:"Branca",b:"Branca",c:"Chocolate",d:"Chocolate",e:"Black",f:"Red",g:"Red"};
  const fewFlavors={...emptyShoppingWeek(),requiredDays:{"2026-10-12":true},daily:{"2026-10-12|a":1,"2026-10-12|b":1}};
  expect(requiredDayWarnings(fewFlavors,"2026-10-12",flavors,batterColors)).toEqual([{date:"2026-10-12",flavorCount:2,whiteCount:2}]);
  const notEnoughWhite={...emptyShoppingWeek(),requiredDays:{"2026-10-12":true},daily:{"2026-10-12|a":1,"2026-10-12|c":1,"2026-10-12|d":1,"2026-10-12|e":1,"2026-10-12|f":1,"2026-10-12|g":1}};
  expect(requiredDayWarnings(notEnoughWhite,"2026-10-12",flavors,batterColors)).toEqual([{date:"2026-10-12",flavorCount:6,whiteCount:1}]);
  const ok={...emptyShoppingWeek(),requiredDays:{"2026-10-12":true},daily:{"2026-10-12|a":1,"2026-10-12|b":1,"2026-10-12|c":1,"2026-10-12|d":1,"2026-10-12|e":1,"2026-10-12|f":1}};
  expect(requiredDayWarnings(ok,"2026-10-12",flavors,batterColors)).toEqual([]);
  expect(requiredDayWarnings({...emptyShoppingWeek(),daily:ok.daily},"2026-10-12",flavors,batterColors)).toEqual([]);
 });
});
