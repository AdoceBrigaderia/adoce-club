import { useEffect, useRef, useState, type FormEvent } from "react";
import { requireSupabase } from "./lib/supabase";

type Details = { id:string; name:string; internal_code:string; item_kind:string; consumption_unit:string; category:string; brand:string; notes:string; updated_at:string };
export default function CostItemEditor({itemId,onClose,onSaved}:{itemId:string;onClose:()=>void;onSaved:()=>Promise<void>}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [details,setDetails]=useState<Details|null>(null);
 const [error,setError]=useState("");
 const [saving,setSaving]=useState(false);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{dialog.current?.showModal();},[]);
 useEffect(()=>{
  let active=true;
  void requireSupabase().rpc("manager_get_costing_catalog_workspace",{requested_item_id:itemId}).then(({data,error})=>{
   if(!active)return;
   setLoading(false);
   if(error)setError(error.message);
   else if(!data?.selected_item)setError("Não foi possível encontrar este cadastro.");
   else setDetails(data.selected_item as Details);
  });
  return()=>{active=false;};
 },[itemId]);
 const set=(key:keyof Details,value:string)=>setDetails(old=>old?{...old,[key]:value}:old);
 async function save(event:FormEvent){
  event.preventDefault(); if(!details||saving)return;
  setSaving(true);setError("");
  try {
   const {error}=await requireSupabase().rpc("manager_update_costing_item_details",{target_item_id:itemId,next_details:details});
   if(error){setError(error.code === "23505" ? "Este código já pertence a outro item. Informe um código único." : error.message);return;}
   await onSaved();onClose();
  } catch {setError("Não foi possível salvar. Confira a conexão e tente novamente.");}
  finally {setSaving(false);}
 }
 return <dialog ref={dialog} className="adoce-item-edit-dialog" aria-labelledby="adoce-item-edit-title" onCancel={event=>{event.preventDefault();if(!saving)onClose();}}>
  <header><h3 id="adoce-item-edit-title">Editar insumo ou embalagem</h3><button type="button" disabled={saving} onClick={onClose} aria-label="Fechar edição do insumo">✕</button></header>
  {loading&&<p role="status">Carregando cadastro…</p>}
  {error&&<p role="alert" className="adoce-item-edit-error">{error}</p>}
  {details&&<form onSubmit={save}>
   <div className="adoce-item-edit-fields">
    <label className="wide">Nome<input required maxLength={160} value={details.name} onChange={e=>set("name",e.target.value)} autoFocus/></label>
    <label>Código único<input required maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,39}" value={details.internal_code} onChange={e=>set("internal_code",e.target.value.toUpperCase())}/></label>
    <label>Tipo<select value={details.item_kind} onChange={e=>set("item_kind",e.target.value)}><option value="ingredient">Insumo</option><option value="packaging">Embalagem</option></select></label>
    <label>Calcular custo e uso por<select value={details.consumption_unit} onChange={e=>set("consumption_unit",e.target.value)}><option value="g">Grama</option><option value="ml">Mililitro</option><option value="unit">Unidade</option></select></label>
    <label>Categoria<input maxLength={120} value={details.category||""} onChange={e=>set("category",e.target.value)}/></label>
    <label className="wide">Marca de referência<input maxLength={120} value={details.brand||""} onChange={e=>set("brand",e.target.value)}/></label>
    <label className="wide">Observações<textarea rows={4} maxLength={2000} value={details.notes||""} onChange={e=>set("notes",e.target.value)}/></label>
   </div>
   <p>Atualize o preço nas notas de compra. A marca registrada em cada compra permanece no histórico. Tipo e unidade de itens já usados em compras ou receitas precisam ser preservados.</p>
   <footer><button type="button" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" disabled={saving}>{saving?"Salvando…":"Salvar alterações"}</button></footer>
  </form>}
 </dialog>;
}
