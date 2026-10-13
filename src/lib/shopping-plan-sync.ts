import { useEffect, useRef, useState } from "react";
import { requireSupabase } from "./supabase";
import {applyDailyQuantity,emptyShoppingWeek,type ShoppingWeek} from "./shopping-week";
export type ShoppingPlan = ShoppingWeek;
export function useShoppingPlanSync(week:string) {
 const [plan,setPlan]=useState<ShoppingWeek>(emptyShoppingWeek);
 const [ready,setReady]=useState(false);
 const [saving,setSaving]=useState(false);
 const [status,setStatus]=useState("Carregando planejamento compartilhado…");
 const pending=useRef<{week:string;group:keyof ShoppingWeek;key:string;value:unknown}[]>([]);
 const running=useRef(false),mounted=useRef(true),generation=useRef(0),activeWeek=useRef(week);
 activeWeek.current=week;
 const refresh=async()=>{
  if(pending.current.length||running.current)return;
  const started=generation.current;
  try {
   const {data,error}=await requireSupabase().rpc("manager_get_shopping_week",{requested_week:week});
   if(error)throw error;
   if(mounted.current&&activeWeek.current===week&&started===generation.current&&!pending.current.length&&!running.current){setPlan({...emptyShoppingWeek(),...data});setReady(true);setStatus("Planejamento salvo e sincronizado");}
  }catch{if(mounted.current&&activeWeek.current===week)setStatus("Não foi possível carregar esta semana. Confira a conexão e tente novamente.");}
 };
 const flush=async()=>{
  if(running.current)return;
  running.current=true;
  try {
   while(pending.current.length){
    const change=pending.current[0];
    const {error}=await requireSupabase().rpc("manager_update_shopping_week",{requested_week:change.week,requested_group:change.group,requested_key:change.key,requested_value:change.value});
    if(error)throw error;
    pending.current.shift();
   }
   if(mounted.current){setSaving(false);setStatus("Planejamento salvo e sincronizado");}
  }catch{if(mounted.current)setStatus("Alteração ainda não salva. Confira a conexão e clique em tentar novamente.");}
  finally{running.current=false;}
 };
 useEffect(()=>{
  mounted.current=true;setReady(false);setPlan(emptyShoppingWeek());setStatus("Carregando planejamento compartilhado…");void refresh();
  const timer=window.setInterval(()=>{if(!pending.current.length)void refresh();},5000);
  const focus=()=>{void refresh();};window.addEventListener("focus",focus);
  return()=>{mounted.current=false;window.clearInterval(timer);window.removeEventListener("focus",focus);};
 },[week]);
 const change=(group:keyof ShoppingWeek,key:string,value:unknown)=>{
  if(!ready)return;
  if(typeof value==="number"&&(!Number.isFinite(value)||value<0||value>1e9))return;
  generation.current++;
  setPlan(current=>group==="daily"?applyDailyQuantity(current,key.split("|")[0],key.split("|")[1],Number(value)):({...current,[group]:{...(current[group]||{}),[key]:value}} as ShoppingWeek));
  pending.current.push({week,group,key,value});setSaving(true);setStatus("Salvando planejamento…");void flush();
 };
 const copyPrevious=async(sourceWeek:string)=>{
  if(!ready||pending.current.length||running.current)return;
  generation.current++;running.current=true;setReady(false);setSaving(true);setStatus("Copiando modelo da semana anterior…");
  try {
   const {data,error}=await requireSupabase().rpc("manager_copy_shopping_week",{source_week:sourceWeek,target_week:week});
   if(error)throw error;
   if(mounted.current&&activeWeek.current===week){generation.current++;setPlan({...emptyShoppingWeek(),...data});setStatus("Modelo copiado e salvo. Confira o estoque atual desta semana.");}
  }catch(error){if(mounted.current)setStatus(error instanceof Error?error.message:"Não foi possível copiar. Esta semana pode já ter um planejamento salvo.");}
  finally{running.current=false;if(mounted.current){setSaving(false);setReady(true);}}
 };
 return {plan,ready,saving,status,change,copyPrevious,retry:()=>{if(pending.current.length)void flush();else void refresh();}};
}
