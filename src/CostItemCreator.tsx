import { useEffect, useRef, useState, type FormEvent } from "react";
import { requireSupabase } from "./lib/supabase";
import type { Unit } from "./lib/cost-engine";

export type CreatedCostIngredient = { id: string; internal_code: string; name: string; item_kind: string; purchase_unit: string; consumption_unit: string; active: boolean; data_status: string; reference_package_name: null; reference_quantity: null; reference_unit: null; price: null };

export default function CostItemCreator({ onClose, onCreated, itemKind = "ingredient" }: { itemKind?: "ingredient" | "packaging"; onClose: () => void; onCreated: (item: CreatedCostIngredient) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState<Unit | "">("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || !name.trim() || !unit) return;
    setSaving(true); setError("");
    try {
      const { data, error: failure } = await requireSupabase().rpc("manager_save_costing_catalog_item", {
        target_item_id: null,
        next_internal_code: code.trim().toUpperCase() || `${itemKind === "packaging" ? "EMB" : "INS"}-${crypto.randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`,
        next_name: name.trim(), next_item_kind: itemKind, next_consumption_unit: unit, next_purchase_unit: unit,
        next_category: category.trim(), next_brand: brand.trim(), next_notes: notes.trim(),
        next_cost_origin: "purchased", next_data_status: "provisional", next_commercial_status: "internal",
      });
      if (failure) { setError(failure.message); return; }
      const saved = data?.selected_item;
      if (!saved?.id) { setError("O cadastro foi enviado, mas não foi possível carregar o insumo. Confira a lista de insumos antes de tentar novamente."); return; }
      onCreated({ id: saved.id, internal_code: saved.internal_code, name: saved.name, item_kind: itemKind, consumption_unit: saved.consumption_unit,
        purchase_unit: saved.purchase_unit, active: true, data_status: "provisional", price: null,
        reference_package_name: null, reference_quantity: null, reference_unit: null });
      onClose();
    } catch { setError("Não foi possível confirmar o cadastro. Confira a conexão e a lista de insumos antes de tentar novamente."); }
    finally { setSaving(false); }
  }
  return <dialog ref={dialog} className="adoce-item-edit-dialog" aria-labelledby="adoce-item-create-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <header><h3 id="adoce-item-create-title">{itemKind === "packaging" ? "Cadastrar descartável nesta ficha" : "Cadastrar insumo nesta preparação"}</h3><button type="button" disabled={saving} onClick={onClose} aria-label="Fechar cadastro do insumo">✕</button></header>
    <p>A preparação em andamento será mantida. O novo insumo ficará selecionado no componente.</p>
    {error && <p role="alert" className="adoce-item-edit-error">{error}</p>}
    <form onSubmit={save}>
      <div className="adoce-item-edit-fields">
        <label className="wide">Nome do insumo<input required autoFocus maxLength={160} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Código interno<input maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,39}" placeholder="Gerado automaticamente se vazio" value={code} onChange={e => setCode(e.target.value.toUpperCase())} /></label>
        <label>Calcular custo e uso por<select required value={unit} onChange={e => setUnit(e.target.value as Unit)}><option value="">Selecione</option><option value="g">Grama (g)</option><option value="ml">Mililitro (ml)</option><option value="unit">Unidade</option></select></label>
        <label>Categoria<input maxLength={120} value={category} onChange={e => setCategory(e.target.value)} /></label>
        <label>Marca de referência<input maxLength={120} value={brand} onChange={e => setBrand(e.target.value)} /></label>
        <label className="wide">Observações<textarea maxLength={2000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      </div>
      <p>Depois, informe a quantidade usada na preparação. O preço será atualizado pelas notas de compra; até lá, o custo deste insumo ficará pendente.</p>
      <footer><button type="button" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" disabled={saving}>{saving ? "Cadastrando…" : "Cadastrar e usar"}</button></footer>
    </form>
  </dialog>;
}
