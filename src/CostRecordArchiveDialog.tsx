import { useEffect, useRef, useState, type FormEvent } from "react";
import { requireSupabase } from "./lib/supabase";
export default function CostRecordArchiveDialog({ kind, id, name, restore=false, linked=false, onClose, onSaved }:{
 kind:"invoice"|"item"; id:string; name:string; restore?:boolean; linked?:boolean; onClose:()=>void; onSaved:()=>Promise<void>;
}) {
 const dialog=useRef<HTMLDialogElement>(null);const [reason,setReason]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{dialog.current?.showModal();},[]);
 async function save(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError("");
  try{
   const {error}=await requireSupabase().rpc("manager_archive_costing_record",{target_kind:kind,target_id:id,next_archive:!restore,next_reason:reason.trim()});
   if(error){setError(error.message);return;}await onSaved();onClose();
  }catch{setError("Não foi possível confirmar a alteração. Confira a lista antes de tentar novamente.");}finally{setBusy(false);}
 }
 return <dialog ref={dialog} className="adoce-item-edit-dialog" aria-labelledby="archive-cost-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <header><h3 id="archive-cost-title">{restore?"Restaurar":"Excluir"} {kind==="invoice"?"nota":"produto"}</h3><button type="button" disabled={busy} onClick={onClose} aria-label="Fechar confirmação">✕</button></header>
  <p><strong>{name}</strong></p>
  <p>{restore?kind==="invoice"?"A nota voltará às compras e ao cálculo de custos.":"O produto voltará a ficar disponível para novos cadastros.":kind==="invoice"?"A nota sairá das compras ativas, da média semanal e dos preços usados no cálculo. A versão excluída ficará disponível para consulta e restauração.":"O produto será ocultado dos novos cadastros. Seu código, suas compras e o histórico permanecerão preservados. Você poderá restaurá-lo."}</p>
  {linked&&!restore&&<p>Este produto está ligado a preparações. Esses vínculos serão preservados; confira as preparações antes de substituir o insumo.</p>}
  <form onSubmit={save}><label>Motivo<textarea required minLength={3} maxLength={500} rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   {error&&<p role="alert" className="adoce-item-edit-error">{error}</p>}
   <footer><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" disabled={busy}>{busy?"Salvando…":restore?"Restaurar cadastro":"Confirmar exclusão"}</button></footer>
  </form>
 </dialog>;
}
