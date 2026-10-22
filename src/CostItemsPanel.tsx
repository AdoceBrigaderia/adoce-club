import { useState, type FormEvent } from "react";
import { requireSupabase } from "./lib/supabase";
import { type Unit } from "./lib/cost-engine";
import { referenceQuantityInBase, type BaseUnit } from "./lib/purchase-invoice";
import { ingredientFromPurchase } from "./lib/cost-purchase-reference";
import { describeItemUsage } from "./table-and-sheet-ui";
import { formatCurrency, formatQuantity, formatUnitCost, formatDate } from "./lib/cost-format";
import { compositionUsage } from "./lib/purchase-planner";
import CostItemEditor from "./CostItemEditor";
import CostRecordArchiveDialog from "./CostRecordArchiveDialog";
import type { Item, PurchaseInvoice, Workspace } from "./OperationCosts";

const costUnits: Unit[] = ["unit", "g", "ml"];
const costKinds = ["ingredient", "packaging"] as const;
const referenceUnits = (base: string): BaseUnit[] => base === "g" ? ["g", "kg"] : base === "ml" ? ["ml", "l"] : base === "unit" ? ["unit"] : [];

export default function CostItemsPanel({ data, usage, purchaseInvoices, busy, setBusy, setNotice, load }: {
  data: Workspace;
  usage: ReturnType<typeof compositionUsage> | null;
  purchaseInvoices: PurchaseInvoice[];
  busy: boolean;
  setBusy: (value: boolean) => void;
  setNotice: (value: string) => void;
  load: () => Promise<void>;
}) {
  const [archivingItem, setArchivingItem] = useState<Item | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemKind, setItemKind] = useState<(typeof costKinds)[number]>("ingredient");
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemUnit, setItemUnit] = useState<Unit | "">("");
  const [itemReferenceName, setItemReferenceName] = useState("");
  const [itemReferenceQuantity, setItemReferenceQuantity] = useState("");
  const [itemReferenceUnit, setItemReferenceUnit] = useState<BaseUnit | "">("");
  const [editingReference, setEditingReference] = useState<{ itemId: string; name: string; quantity: string; unit: BaseUnit | "" } | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [itemFilter, setItemFilter] = useState("all");
  const [itemSort, setItemSort] = useState("name");
  const [itemDirection, setItemDirection] = useState("asc");

  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    if ((itemReferenceName || itemReferenceQuantity || itemReferenceUnit) &&
      (!itemReferenceName.trim() || !itemReferenceQuantity || !itemReferenceUnit ||
        referenceQuantityInBase(itemReferenceQuantity, itemReferenceUnit, itemUnit as BaseUnit) == null))
      return setNotice("Preencha nome, conteúdo e unidade compatível da embalagem de referência.");
    setBusy(true);
    const { error } = await requireSupabase().rpc("manager_create_costing_item_with_reference", {
      next_internal_code: itemCode.trim().toUpperCase(), next_name: itemName.trim(),
      next_item_kind: itemKind, next_consumption_unit: itemUnit,
      next_package_name: itemReferenceName.trim() || null,
      next_quantity: itemReferenceQuantity ? Number(itemReferenceQuantity) : null,
      next_unit: itemReferenceUnit || null,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setItemName(""); setItemCode(""); setItemUnit(""); setItemReferenceName(""); setItemReferenceQuantity(""); setItemReferenceUnit(""); await load(); setNotice("Item salvo. Registre e confira seu preço em uma nota de compra para calcular.");
  };
  const saveReference = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingReference) return;
    const item = data.items.find(candidate => candidate.id === editingReference.itemId);
    if ((editingReference.name || editingReference.quantity || editingReference.unit) &&
      (!editingReference.name.trim() || !editingReference.quantity || !editingReference.unit ||
        !item || referenceQuantityInBase(editingReference.quantity, editingReference.unit, item.consumption_unit as BaseUnit) == null))
      return setNotice("Preencha nome, conteúdo e unidade compatível da embalagem de referência.");
    setBusy(true);
    const { error } = await requireSupabase().rpc("manager_set_costing_item_reference", {
      target_item_id: editingReference.itemId,
      next_package_name: editingReference.name.trim() || null,
      next_quantity: editingReference.quantity ? Number(editingReference.quantity) : null,
      next_unit: editingReference.unit || null,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setEditingReference(null); await load(); setNotice("Embalagem de referência atualizada para comparação visual.");
  };
  const validateItem = async (id: string) => {
    setBusy(true);
    const { error } = await requireSupabase().rpc("manager_validate_costing_item", { target_item_id: id });
    setBusy(false);
    if (error) return setNotice(error.message);
    await load(); setNotice("Item conferido e validado.");
  };

  return <>
    {archivingItem && <CostRecordArchiveDialog kind="item" id={archivingItem.id} name={archivingItem.name} restore={!archivingItem.active} linked={!!data.components.some(component => component.item_id === archivingItem.id)} onClose={() => setArchivingItem(null)} onSaved={load} />}
    {editingItemId && <CostItemEditor itemId={editingItemId} onClose={() => setEditingItemId(null)} onSaved={async () => { await load(); setNotice("Cadastro atualizado. Histórico de compras e preços preservado."); }} />}
    <div className="adoce-cost-grid adoce-items-layout">
      <form className="adoce-item-create" onSubmit={saveItem}><h4>Novo insumo ou embalagem</h4>
        <label>Tipo<select value={itemKind} onChange={e => setItemKind(e.target.value as typeof itemKind)}><option value="ingredient">Insumo</option><option value="packaging">Embalagem</option></select></label>
        <label>Nome<input required maxLength={160} value={itemName} onChange={e => setItemName(e.target.value)} /></label>
        <label>Código interno<input required maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" value={itemCode} onChange={e => setItemCode(e.target.value)} /></label>
        <label>Calcular custo e uso por<select required value={itemUnit} onChange={e => { setItemUnit(e.target.value as Unit); setItemReferenceUnit(""); }}><option value="">Escolha a unidade</option>{costUnits.map(unit => <option key={unit} value={unit}>{unit === "unit" ? "unidade" : unit === "g" ? "grama" : "mililitro"}</option>)}</select></label>
        <small>Esta unidade também será usada na ficha técnica. A nota converte caixas, pacotes, kg e litros para ela.</small>
        <fieldset className="adoce-reference-fields"><legend>Embalagem de referência para comparar preços</legend>
          <label>Nome da embalagem<input required={Boolean(itemReferenceName || itemReferenceQuantity || itemReferenceUnit)} maxLength={60} value={itemReferenceName} onChange={e => setItemReferenceName(e.target.value)} placeholder="Ex.: caixinha" /></label>
          <div><label>Conteúdo padrão<input required={Boolean(itemReferenceName || itemReferenceQuantity || itemReferenceUnit)} type="number" min="0.000001" step="any" value={itemReferenceQuantity} onChange={e => setItemReferenceQuantity(e.target.value)} placeholder="Ex.: 395" /></label>
          <label>Unidade<select required={Boolean(itemReferenceName || itemReferenceQuantity || itemReferenceUnit)} value={itemReferenceUnit} onChange={e => setItemReferenceUnit(e.target.value as BaseUnit)}><option value="">Escolha</option>{referenceUnits(itemUnit).map(unit => <option key={unit} value={unit}>{unit === "unit" ? "unidade" : unit}</option>)}</select></label></div>
          <small>Opcional. Mostra o equivalente de preço da embalagem comum; não altera o custo da ficha.</small>
        </fieldset>
        <button type="submit" disabled={busy}>Cadastrar</button>
      </form>
      <div className="adoce-cost-list adoce-items-table-panel"><h4>Itens cadastrados</h4>
        <div className="adoce-items-filters"><label>Buscar nome, código ou marca<input type="search" value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Digite para encontrar" /></label><label>Filtrar<select value={itemFilter} onChange={e => setItemFilter(e.target.value)}><option value="all">Itens ativos</option><option value="archived">Excluídos · restaurar</option><option value="ingredient">Insumos</option><option value="packaging">Embalagens</option><option value="validated">Com preço de compra</option><option value="pending">Cálculo incompleto</option><option value="no_purchase">Sem compra registrada</option><option value="unused">Sem uso em composição</option></select></label><label>Ordenar por<select value={itemSort} onChange={e => setItemSort(e.target.value)}><option value="name">Nome</option><option value="brand">Marca da última compra</option><option value="date">Data da última compra</option><option value="total">Total da última compra</option><option value="cost">Custo por unidade de uso</option><option value="unused">Sem uso primeiro</option></select></label><label>Ordem<select value={itemDirection} onChange={e => setItemDirection(e.target.value)}><option value="asc">Crescente</option><option value="desc">Decrescente</option></select></label></div>
        <div className="adoce-items-table-scroll"><table className="adoce-items-table"><thead><tr>{["Produto", "Última compra", "Marca", "Média semanal", "Embalagem comprada", "Custo de uso", "Referência", "Composição das tortas", "Situação e ações"].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead><tbody>{data.items.filter(item => {
          const purchases = purchaseInvoices.flatMap(invoice => invoice.lines.filter(line => line.item_id === item.id));
          const validated = !!ingredientFromPurchase(item).purchased;
          const text = `${item.name} ${item.internal_code || ""} ${purchases.map(line => line.brand_name).join(" ")}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
          return (itemFilter === "archived" ? !item.active : item.active) && text.includes(itemSearch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()) && (itemFilter === "all" || itemFilter === "archived" || itemFilter === item.item_kind || itemFilter === "validated" && validated || itemFilter === "pending" && !validated || itemFilter === "no_purchase" && !purchases.length || itemFilter === "unused" && !usage?.items[item.id]?.used);
        }).sort((a, b) => {
          const last = (id: string) => purchaseInvoices.flatMap(invoice => invoice.lines.filter(line => line.item_id === id).map(line => ({ ...line, date: invoice.issued_on }))).sort((x, y) => y.date.localeCompare(x.date))[0];
          const x = last(a.id), y = last(b.id);
          const compared = itemSort === "unused" ? Number(usage?.items[a.id]?.used || false) - Number(usage?.items[b.id]?.used || false) || a.name.localeCompare(b.name, "pt-BR") : itemSort === "total" ? Number(x?.net_total || 0) - Number(y?.net_total || 0) : itemSort === "cost" ? (x ? x.net_total / Number(x.useful_quantity || x.normalized_quantity) : 0) - (y ? y.net_total / Number(y.useful_quantity || y.normalized_quantity) : 0) : (itemSort === "brand" ? x?.brand_name || "" : itemSort === "date" ? x?.date || "" : a.name).localeCompare(itemSort === "brand" ? y?.brand_name || "" : itemSort === "date" ? y?.date || "" : b.name, "pt-BR", { numeric: true });
          return (itemDirection === "desc" ? -1 : 1) * compared;
        }).map(item => {
        const reference = referenceQuantityInBase(item.reference_quantity, item.reference_unit, item.consumption_unit as BaseUnit);
        const equivalent = reference && item.price ? item.price.purchase_price / Number(item.price.useful_quantity || item.price.purchased_quantity) * reference : null;
        const purchases = purchaseInvoices.flatMap(invoice => invoice.lines.filter(line => line.item_id === item.id).map(line => ({ ...line, issued_on: invoice.issued_on, created_at: invoice.created_at })));
        purchases.sort((a, b) => b.issued_on.localeCompare(a.issued_on) || b.created_at.localeCompare(a.created_at));
        const last = purchases[0];
        const firstDate = purchases.length ? purchases[purchases.length - 1].issued_on : null;
        const firstDay = firstDate ? Date.parse(`${firstDate}T00:00:00Z`) : NaN;
        const today = new Date();
        const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        const weeks = firstDate ? Math.max(1, Math.ceil((Math.max(0, Math.floor((todayUtc - firstDay) / 86400000)) + 1) / 7)) : 0;
        const weeklyAverage = weeks ? purchases.reduce((sum, line) => sum + Number(line.normalized_quantity), 0) / weeks : null;
        const packageCount = Number(last?.package_layers[0]?.quantity);
        const packageName = last?.package_layers[0]?.name || "embalagem";
        const packageQuantity = last && packageCount > 0 ? Number(last.normalized_quantity) / packageCount : null;
        const packageCost = last && packageCount > 0 ? Number(last.net_total) / packageCount : null;
        const unitCost = last ? Number(last.net_total) / Number(last.useful_quantity || last.normalized_quantity) : null;
        return <tr key={item.id}><td data-label="Produto"><strong>{item.name}</strong><small>Código: {item.internal_code}</small><button type="button" disabled={busy} onClick={() => setEditingItemId(item.id)} aria-label={`Editar ${item.name}`}>Editar nome e cadastro</button><button type="button" disabled={busy} onClick={() => setArchivingItem(item)}>{item.active ? "Excluir produto" : "Restaurar produto"}</button><small>{item.item_kind === "packaging" ? "Embalagem" : "Insumo"}</small></td>
          <td data-label="Última compra">{last ? <>{formatDate(last.issued_on)}<strong>{formatCurrency(Number(last.net_total))}</strong><small>{formatQuantity(Number(last.normalized_quantity))} {last.normalized_unit}</small></> : "Sem compra"}</td>
          <td data-label="Marca">{last?.brand_name || "Não informada"}</td>
          <td data-label="Média semanal">{weeklyAverage == null ? "Aguardando compra" : <>{formatQuantity(weeklyAverage)} {item.consumption_unit}/semana<small>Desde {formatDate(firstDate!)}</small></>}</td>
          <td data-label="Embalagem comprada">{last && packageQuantity != null && packageCost != null ? <>{packageName} de {formatQuantity(packageQuantity)} {last.normalized_unit}<strong>{formatCurrency(packageCost)}</strong></> : "—"}</td>
          <td data-label="Custo de uso">{unitCost == null ? "—" : `${formatUnitCost(unitCost)} / ${item.consumption_unit}`}</td>
          <td data-label="Referência">{reference ? <span className="adoce-reference-result">{item.reference_package_name} de {item.reference_quantity} {item.reference_unit}: {equivalent == null ? "aguardando preço" : `${formatCurrency(equivalent)} (equivalente)`}</span> : "Sem referência"}</td>
          <td data-label="Composição das tortas">{describeItemUsage(
            { id: item.id, name: item.name, internalCode: item.internal_code },
            usage?.items[item.id],
            data.items.map(candidate => ({ item: { id: candidate.id, name: candidate.name, internalCode: candidate.internal_code }, usage: usage?.items[candidate.id] || { used: false, cakes: [] } })),
          )}</td><td data-label="Situação e ações">

          <small>{ingredientFromPurchase(item).purchased ? item.price?.useful_quantity == null ? "Custo pela quantidade comprada" : "Custo pela quantidade útil" : "Sem preço de compra disponível"}</small>
          <button type="button" disabled={busy} onClick={() => setEditingReference({ itemId: item.id, name: item.reference_package_name || "", quantity: item.reference_quantity == null ? "" : String(item.reference_quantity), unit: item.reference_unit || "" })}>Editar embalagem de referência</button>
          {editingReference?.itemId === item.id && <form onSubmit={saveReference} className="adoce-reference-editor"><label>Nome da embalagem<input maxLength={60} value={editingReference.name} onChange={e => setEditingReference({ ...editingReference, name: e.target.value })} placeholder="Ex.: caixinha" /></label><div><label>Conteúdo padrão<input type="number" min="0.000001" step="any" value={editingReference.quantity} onChange={e => setEditingReference({ ...editingReference, quantity: e.target.value })} /></label><label>Unidade<select value={editingReference.unit} onChange={e => setEditingReference({ ...editingReference, unit: e.target.value as BaseUnit })}><option value="">Escolha</option>{referenceUnits(item.consumption_unit).map(unit => <option key={unit} value={unit}>{unit === "unit" ? "unidade" : unit}</option>)}</select></label></div><button type="submit" disabled={busy}>Salvar referência</button><button type="button" onClick={() => setEditingReference(null)}>Cancelar</button></form>}
          {item.active && item.data_status !== "validated" && item.price?.data_status === "validated" && <button type="button" disabled={busy} onClick={() => void validateItem(item.id)}>Validar item conferido</button>}
        </td></tr>;
      })}</tbody></table></div><p className="adoce-items-empty">Use a busca e os filtros para encontrar os itens. Se nenhum resultado aparecer, altere os filtros.</p></div>
      <div className="adoce-cost-list"><h4>Histórico de preços</h4><label>Item<select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}><option value="">Selecione</option>{data.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{selectedItemId ? (data.prices || []).filter(price => price.item_id === selectedItemId).map(price => <div key={price.id}><strong>{new Date(price.effective_at).toLocaleDateString("pt-BR")}</strong><span>{formatCurrency(price.purchase_price)} / {price.purchased_quantity} {price.purchase_unit} · útil: {price.useful_quantity ?? "não informada"}</span><small>{price.useful_quantity == null ? "Base: quantidade comprada" : "Base: quantidade útil"} · {price.source_note}</small></div>) : <p>Selecione um item para consultar o histórico.</p>}</div>
    </div>
  </>;
}
