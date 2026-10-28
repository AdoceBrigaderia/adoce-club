import {describe,expect,it} from "vitest";
import {cashDraftRequestedItems,cashDraftStorageKey} from "./cash-draft-persistence";

describe("rascunho de venda por aba",()=>{
  it("mantém uma chave estável por sessão sem misturar os itens",()=>{
    expect(cashDraftStorageKey("sessao-1")).toBe("adoce:cash-draft:sessao-1");
    expect(cashDraftRequestedItems({a:2,b:0,c:1})).toEqual([{flavor_id:"a",quantity:2},{flavor_id:"c",quantity:1}]);
  });
});
