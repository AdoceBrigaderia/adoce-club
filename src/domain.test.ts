import { describe, expect, it } from "vitest";
import { Customer, earn, redeem, rewardsFor } from "./domain";
const customer=(balance:number):Customer=>({id:"1",name:"Rubens",phone:"11999999999",balance,token:"t",status:"ACTIVE",marketingConsent:false,transactions:[]});
describe("regras de fidelidade",()=>{
  it.each([[0,1,1],[8,3,11],[13,1,14],[13,3,16]])("soma %i + %i = %i",(before,qty,after)=>expect(earn(customer(before),qty,"k").balance).toBe(after));
  it.each([[14,0],[16,2]])("resgata de %i preservando %i",(before,after)=>expect(redeem(customer(before),"k").balance).toBe(after));
  it("calcula duas recompensas",()=>expect(rewardsFor(28)).toBe(2));
  it("bloqueia saldo negativo",()=>expect(()=>redeem(customer(13),"k")).toThrow("INSUFFICIENT_BALANCE"));
  it("é idempotente",()=>{const first=earn(customer(8),3,"same");expect(earn(first,3,"same").balance).toBe(11)});
});
