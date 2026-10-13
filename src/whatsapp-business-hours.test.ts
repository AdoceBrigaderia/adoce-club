import {describe,it,expect} from "vitest";
import {whatsappHours} from "../netlify/functions/_shared/whatsapp-business-hours";
describe("janelas de pedidos e atendimento",()=>{
  it.each([
    ["2026-09-14T12:00:00-03:00",false,true],
    ["2026-09-15T11:59:00-03:00",false,true],
    ["2026-09-15T12:00:00-03:00",true,true],
    ["2026-09-19T21:59:00-03:00",true,true],
    ["2026-09-19T22:00:00-03:00",false,false],
    ["2026-09-20T15:00:00-03:00",false,false],
    ["2026-09-14T08:59:00-03:00",false,false],
    ["2026-09-14T09:00:00-03:00",false,true],
  ])("%s: pedidos=%s equipe=%s",(date,orders,support)=>{
    expect(whatsappHours(new Date(date))).toEqual({orders,support});
  });
});
