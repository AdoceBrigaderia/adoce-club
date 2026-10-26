import { useEffect, useRef, useState } from "react";
import { requireSupabase } from "./supabase";
import {applyDailyQuantity,diffShoppingWeekDrafts,emptyShoppingWeek,DRAFT_GROUPS,type ShoppingWeek} from "./shopping-week";
export type ShoppingPlan = ShoppingWeek;
export function useShoppingPlanSync(week:string) {
 const [saved,setSaved]=useState<ShoppingWeek>(emptyShoppingWeek);
 const [draft,setDraft]=useState<ShoppingWeek>(emptyShoppingWeek);
 const [dirty,setDirty]=useState(false);
 const [ready,setReady]=useState(false);
 const [saving,setSaving]=useState(false);
 const [status,setStatus]=useState("Carregando planejamento compartilhado…");
 const pending=useRef<{week:string;group:keyof ShoppingWeek;key:string;value:unknown}[]>([]);
 const running=useRef(false),mounted=useRef(true),generation=useRef(0),activeWeek=useRef(week),dirtyRef=useRef(false);
 activeWeek.current=week;dirtyRef.current=dirty;
 const refresh=async()=>{
  if(pending.current.length||running.current||dirtyRef.current)return;
  const started=generation.current;
  try {
   const {data,error}=await requireSupabase().rpc("manager_get_shopping_week",{requested_week:week});
   if(error)throw error;
   if(mounted.current&&activeWeek.current===week&&started===generation.current&&!pending.current.length&&!running.current&&!dirtyRef.current){
    const next={...emptyShoppingWeek(),...data};
    setSaved(next);setDraft(next);setReady(true);setStatus("Planejamento salvo e sincronizado");
   }
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
  }catch(error){if(mounted.current)setStatus(error instanceof Error&&error.message?`Não foi possível salvar: ${error.message}`:"Alteração ainda não salva. Confira a conexão e clique em tentar novamente.");}
  finally{running.current=false;}
 };
 useEffect(()=>{
  mounted.current=true;setReady(false);setDirty(false);setSaved(emptyShoppingWeek());setDraft(emptyShoppingWeek());setStatus("Carregando planejamento compartilhado…");void refresh();
  const timer=window.setInterval(()=>{if(!pending.current.length&&!dirtyRef.current)void refresh();},5000);
  const focus=()=>{if(!dirtyRef.current)void refresh();};window.addEventListener("focus",focus);
  return()=>{mounted.current=false;window.clearInterval(timer);window.removeEventListener("focus",focus);};
 },[week]);
 const change=(group:keyof ShoppingWeek,key:string,value:unknown)=>{
  if(!ready)return;
  if(typeof value==="number"&&(!Number.isFinite(value)||value<0||value>1e9))return;
  if((DRAFT_GROUPS as readonly string[]).includes(group)){
   setDraft(current=>group==="daily"?applyDailyQuantity(current,key.split("|")[0],key.split("|")[1],Number(value)):({...current,[group]:{...(current[group]||{}),[key]:value}} as ShoppingWeek));
   setDirty(true);
   return;
  }
  generation.current++;
  setSaved(current=>({...current,[group]:{...(current[group]||{}),[key]:value}} as ShoppingWeek));
  setDraft(current=>({...current,[group]:{...(current[group]||{}),[key]:value}} as ShoppingWeek));
  pending.current.push({week,group,key,value});setSaving(true);setStatus("Salvando…");void flush();
 };
 const save=async():Promise<boolean>=>{
  if(!dirtyRef.current)return false;
  setSaving(true);setStatus("Salvando planejamento…");
  for(const change of diffShoppingWeekDrafts(saved,draft))pending.current.push({week,...change});
  if(!running.current)await flush();
  else while(running.current)await new Promise(resolve=>window.setTimeout(resolve,50));
  if(!mounted.current)return false;
  setSaving(false);
  if(pending.current.length)return false;
  setSaved(draft);setDirty(false);setStatus("Planejamento salvo e sincronizado");
  return true;
 };
 const discard=()=>{setDraft(saved);setDirty(false);setStatus("Planejamento salvo e sincronizado");};
 const copyPrevious=async(sourceWeek:string)=>{
  if(!ready||pending.current.length||running.current)return;
  generation.current++;running.current=true;setReady(false);setSaving(true);setDirty(false);setStatus("Copiando modelo da semana anterior…");
  try {
   const {data,error}=await requireSupabase().rpc("manager_copy_shopping_week",{source_week:sourceWeek,target_week:week});
   if(error)throw error;
   if(mounted.current&&activeWeek.current===week){generation.current++;const next={...emptyShoppingWeek(),...data};setSaved(next);setDraft(next);setStatus("Modelo copiado e salvo. Confira o estoque atual desta semana.");}
  }catch(error){if(mounted.current)setStatus(error instanceof Error?error.message:"Não foi possível copiar. Esta semana pode já ter um planejamento salvo.");}
  finally{running.current=false;if(mounted.current){setSaving(false);setReady(true);}}
 };
 return {plan:draft,saved,ready,saving,dirty,status,change,save,discard,copyPrevious,retry:()=>{if(pending.current.length)void flush();else void refresh();}};
}
