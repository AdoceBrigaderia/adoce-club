import {describe,expect,it} from "vitest";
import {canEnrollSaleCustomer} from "./sale-club-enroll";

describe("cadastro opcional do cliente durante a venda",()=>{
  it.each([
    ["","",false],
    ["Maria","85999999999",false],
    ["Maria da Silva","",false],
    ["","85999999999",false],
    ["Maria da Silva","85999999999",true],
  ])("decide cadastro sem transformar dados parciais em bloqueio",(name,phone,expected)=>{
    expect(canEnrollSaleCustomer(name,phone)).toBe(expected);
  });
});
