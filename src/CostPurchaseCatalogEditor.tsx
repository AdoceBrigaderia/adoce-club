import { useEffect, useRef, useState, type FormEvent } from "react";
import { requireSupabase } from "./lib/supabase";

type Entry = { id: string; name: string; physical_quantity?: number; physical_unit?: string };
export default function CostPurchaseCatalogEditor({ suppliers, packages, contents, onClose, onSaved }: {
 suppliers: Entry[]; packages: Entry[]; contents: Entry[]; onClose:()=>void; onSaved:()=>Promise<void>;
}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [kind,setKind]=useState("supplier");
 const [selected,setSelected]=useState<Entry|null>(null);
 const [name,setName]=useState(""); const [quantity,setQuantity]=useState(""); const [unit,setUnit]=useState("g");
 const [busy,setBusy]=useState(false); const [notice,setNotice]=useState("");
 useEffect(()=>{dialog.current?.showModal();},[]);
 const entries=kind==="supplier"?suppliers:kind==="package"?packages:contents;
 const select=(id:string)=>{const e=entries.find(x=>x.id===id)||null;setSelected(e);setName(e?.name||"");setQuantity(String(e?.physical_quantity||""));setUnit(e?.physical_unit||"g");setNotice("");};
 async function save(event:FormEvent){
  event.preventDefault();if(!selected||busy)return;setBusy(true);setNotice("");
  try {
   const {error}=await requireSupabase().rpc("manager_edit_costing_purchase_catalog",{
    target_kind:kind,target_id:selected.id,expected_data:selected,
    next_data:{name:name.trim(),...(kind==="content"?{physical_quantity:Number(quantity),physical_unit:unit}:{})}
   });
   if(error){setNotice(error.code==="23505"?"Já existe um cadastro com esse nome. Escolha outro nome.":error.message);return;}
   await onSaved();onClose();
  }catch{setNotice("Não foi possível confirmar a alteração. Confira a conexão.");}finally{setBusy(false);}
 }
 return <dialog ref={dialog} className="adoce-item-edit-dialog" aria-labelledby="purchase-catalog-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <header><h3 id="purchase-catalog-title">Editar fornecedores e embalagens</h3><button type="button" disabled={busy} onClick={onClose} aria-label="Fechar edição dos cadastros">✕</button></header>
  <form onSubmit={save}><div className="adoce-item-edit-fields">
   <label className="wide">Cadastro<select value={kind} disabled={busy} onChange={e=>{setKind(e.target.value);setSelected(null);setNotice("");}}><option value="supplier">Fornecedor</option><option value="package">Tipo de embalagem</option><option value="content">Unidade de conteúdo</option></select></label>
   <label className="wide">Registro<select required disabled={busy} value={selected?.id||""} onChange={e=>select(e.target.value)}><option value="">Selecione</option>{entries.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
   {selected&&<><label className="wide">Nome<input required maxLength={kind==="package"?40:kind==="supplier"?160:80} value={name} onChange={e=>setName(e.target.value)}/></label>
    {kind==="content"&&<><label>Conteúdo físico<input required type="number" min="0.000001" step="any" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><label>Unidade<select value={unit} onChange={e=>setUnit(e.target.value)}>{["g","kg","ml","l","unit"].map(u=><option key={u} value={u}>{u==="unit"?"unidade":u}</option>)}</select></label></>}
   </>}
  </div><p>As compras anteriores mantêm suas quantidades e valores. A definição atualizada será usada nas próximas notas. As alterações ficam registradas no histórico de auditoria.</p>
  {notice&&<p role="alert" className="adoce-item-edit-error">{notice}</p>}
  <footer><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" disabled={!selected||busy}>{busy?"Salvando…":"Salvar alterações"}</button></footer></form>
 </dialog>;
}
