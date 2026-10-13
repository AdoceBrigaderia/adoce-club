import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { requireSupabase } from "./lib/supabase";
import { grossLineTotal, moneyFromTypedDigits, normalizePurchaseQuantity, referenceQuantityInBase, type BaseUnit, type PackageLayer } from "./lib/purchase-invoice";
import "./cost-purchase-invoice.css";
import CostRecordArchiveDialog from "./CostRecordArchiveDialog";
import CostPurchaseCatalogEditor from "./CostPurchaseCatalogEditor";

type Item = { id: string; name: string; item_kind: string; consumption_unit: string; reference_package_name: string | null; reference_quantity: number | null; reference_unit: BaseUnit | null; active: boolean };
type InvoiceLine = { id: string; item_id: string; item_name: string; brand_name: string; item_notes: string; package_layers: PackageLayer[]; content_quantity: number; content_unit: string; entered_content_quantity: number | null; content_presentation: string | null; outer_unit_price: number | null; gross_total: number; normalized_quantity: number; normalized_unit: string; useful_quantity: number | null; net_total: number };
type Invoice = { id: string; supplier_id: string; notes: string; supplier_name: string; invoice_number: string; series: string; issued_on: string; subtotal: number; discount_total: number; freight_total: number; total_cost: number; lines: InvoiceLine[] };
type ContentUnit = { id: string; name: string; physical_quantity: number; physical_unit: BaseUnit };
type PurchaseCatalog = { package_types: { id: string; name: string }[]; content_units: ContentUnit[] };
type Supplier = { id: string; name: string; invoice_count: number; last_purchase: string | null };
type DraftLine = {
  key: string; itemId: string; newItemKind: "ingredient" | "packaging"; newItemName: string; newItemCode: string;
  baseUnit: BaseUnit | ""; layers: PackageLayer[]; contentQuantity: string; contentUnit: string;
  newContentUnitName: string; newContentUnitQuantity: string; newContentUnitPhysicalUnit: BaseUnit | "";
  usefulQuantity: string; checked: boolean; unitPrice: string; brandName: string; itemNotes: string;
  referencePackageName: string; referenceQuantity: string; referenceUnit: BaseUnit | "";
};
const units: BaseUnit[] = ["g", "kg", "ml", "l", "unit"];
const costUnits: BaseUnit[] = ["unit", "g", "ml"];
const referenceUnits = (base: string): BaseUnit[] => base === "g" ? ["g", "kg"] : base === "ml" ? ["ml", "l"] : base === "unit" ? ["unit"] : [];
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const unitMoney = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
const nextLine = (): DraftLine => ({ key: crypto.randomUUID(), itemId: "", newItemKind: "ingredient", newItemName: "", newItemCode: "", baseUnit: "", layers: [{ name: "", quantity: "" }], contentQuantity: "", contentUnit: "", newContentUnitName: "", newContentUnitQuantity: "", newContentUnitPhysicalUnit: "", usefulQuantity: "", checked: false, unitPrice: "", brandName: "", itemNotes: "", referencePackageName: "", referenceQuantity: "", referenceUnit: "" });

export default function CostPurchaseInvoice({ items, onSaved }: { items: Item[]; onSaved: () => Promise<void> }) {
  const [archivingInvoice, setArchivingInvoice] = useState<{ id: string; name: string; restore: boolean } | null>(null);
  const [archivedInvoices, setArchivedInvoices] = useState<Invoice[] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingCatalog, setEditingCatalog] = useState(false);
  const [revisions, setRevisions] = useState<Record<string, { id: string; invoice_number: string; supplier_name: string; issued_on: string; total_cost: number; lines: { item_name: string; brand_name: string; normalized_quantity: number; normalized_unit: string; net_total: number }[] }[]>>({});
  const [supplier, setSupplier] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [number, setNumber] = useState("");
  const [series, setSeries] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [discount, setDiscount] = useState("");
  const [freight, setFreight] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([nextLine()]);
  const [invoiceSort, setInvoiceSort] = useState("newest");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [catalog, setCatalog] = useState<PurchaseCatalog>({ package_types: [], content_units: [] });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [historyItem, setHistoryItem] = useState("");

  const loadHistory = useCallback(async () => {
    const { data, error } = await requireSupabase().rpc("manager_get_costing_purchase_workspace");
    if (error) setNotice(error.message);
    else setInvoices(data as Invoice[]);
  }, []);
  const loadArchived = async () => {
    const { data, error } = await requireSupabase().rpc("manager_get_archived_costing_invoices");
    if (error) setNotice(error.message); else setArchivedInvoices(data || []);
  };
  const loadCatalog = useCallback(async () => {
    const { data, error } = await requireSupabase().rpc("manager_get_costing_purchase_catalog");
    if (error) setNotice(error.message);
    else setCatalog(data as PurchaseCatalog);
  }, []);
  const loadSuppliers = useCallback(async () => {
    const { data, error } = await requireSupabase().rpc("manager_get_costing_suppliers");
    if (error) setNotice(error.message);
    else setSuppliers(data as Supplier[]);
  }, []);
  useEffect(() => { void Promise.all([loadHistory(), loadCatalog(), loadSuppliers()]); }, [loadHistory, loadCatalog, loadSuppliers]);

  const createSupplier = async () => {
    const name = newSupplierName.trim();
    if (!name) return setNotice("Informe o nome do fornecedor.");
    setBusy(true);
    const { data, error } = await requireSupabase().rpc("manager_create_costing_supplier", { next_name: name });
    setBusy(false);
    if (error) return setNotice(error.message);
    await loadSuppliers();
    setSupplier(data.name);
    setNewSupplierName("");
    setNotice("Fornecedor cadastrado e selecionado para a nota.");
  };

  const updateLine = (key: string, change: Partial<DraftLine>) =>
    setLines(current => current.map(line => line.key === key ? { ...line, ...change } : line));
  const cancelEditing = () => {
    setEditingInvoice(null); setSupplier(""); setNumber(""); setSeries(""); setIssuedOn("");
    setDiscount(""); setFreight(""); setNotes(""); setLines([nextLine()]); setNotice("");
  };
  const openInvoice = (invoice: Invoice) => {
    if ((supplier || number || lines.some(line => line.itemId)) && !window.confirm("Abrir esta nota vai substituir os dados ainda não salvos do formulário. Continuar?")) return;
    setEditingInvoice(invoice); setSupplier(suppliers.find(entry => entry.id === invoice.supplier_id)?.name || invoice.supplier_name);
    setNumber(invoice.invoice_number); setSeries(invoice.series); setIssuedOn(invoice.issued_on);
    setDiscount(String(invoice.discount_total)); setFreight(String(invoice.freight_total)); setNotes(invoice.notes || "");
    setLines(invoice.lines.map(line => ({
      ...nextLine(), itemId: line.item_id, layers: line.package_layers,
      contentQuantity: String(line.content_quantity), contentUnit: line.content_unit,
      unitPrice: String(line.outer_unit_price ?? line.gross_total / Number(line.package_layers[0]?.quantity || 1)),
      usefulQuantity: line.useful_quantity == null ? "" : String(line.useful_quantity),
      checked: false, brandName: line.brand_name || "", itemNotes: line.item_notes || "",
    })));
    setNotice(""); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const loadRevisions = async (id: string) => {
    setBusy(true);
    try {
      const { data, error } = await requireSupabase().rpc("manager_get_costing_invoice_revisions", { target_invoice_id: id });
      if (error) setNotice(error.message); else setRevisions(current => ({ ...current, [id]: data || [] }));
    } finally { setBusy(false); }
  };
  const updateLayer = (key: string, index: number, change: Partial<PackageLayer>) =>
    setLines(current => current.map(line => line.key === key ? {
      ...line, layers: line.layers.map((layer, i) => i === index ? { ...layer, ...change } : layer),
    } : line));
  const baseUnitOf = (line: DraftLine) => line.itemId === "new" ? line.baseUnit : items.find(item => item.id === line.itemId)?.consumption_unit as BaseUnit | undefined;
  const physicalContentOf = (line: DraftLine): { quantity: number; unit: BaseUnit } | null => {
    const count = Number(line.contentQuantity);
    if (!Number.isFinite(count) || count <= 0) return null;
    if (units.includes(line.contentUnit as BaseUnit)) return { quantity: count, unit: line.contentUnit as BaseUnit };
    const selected = catalog.content_units.find(unit => unit.id === line.contentUnit);
    if (selected) return { quantity: count * selected.physical_quantity, unit: selected.physical_unit };
    if (line.contentUnit === "new" && line.newContentUnitName.trim() && line.newContentUnitPhysicalUnit && Number(line.newContentUnitQuantity) > 0)
      return { quantity: count * Number(line.newContentUnitQuantity), unit: line.newContentUnitPhysicalUnit };
    return null;
  };
  const normalized = (line: DraftLine) => {
    const baseUnit = baseUnitOf(line);
    const content = physicalContentOf(line);
    return baseUnit && units.includes(baseUnit) && content ? normalizePurchaseQuantity(line.layers, String(content.quantity), content.unit, baseUnit) : null;
  };
  const referenceComparison = (itemId: string, netTotal: number, quantity: number) => {
    const item = items.find(candidate => candidate.id === itemId);
    if (!item?.reference_package_name || !item.reference_unit || !item.reference_quantity || quantity <= 0) return "Sem referência";
    const reference = referenceQuantityInBase(item.reference_quantity, item.reference_unit, item.consumption_unit as BaseUnit);
    return reference == null ? "Sem referência" : `${money(netTotal / quantity * reference)} / ${item.reference_package_name} de ${item.reference_quantity} ${item.reference_unit}`;
  };
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + Number(grossLineTotal(line.layers[0]?.quantity || "", line.unitPrice) || 0), 0), [lines]);
  const total = subtotal - (Number(discount) || 0) + (Number(freight) || 0);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (lines.some(line => !line.itemId || normalized(line) == null || !grossLineTotal(line.layers[0]?.quantity || "", line.unitPrice) ||
      (line.itemId === "new" && !line.newItemName.trim()) ||
      (line.itemId === "new" && (line.referencePackageName || line.referenceQuantity || line.referenceUnit) &&
        (!line.referencePackageName.trim() || !line.referenceQuantity || !line.referenceUnit ||
          referenceQuantityInBase(line.referenceQuantity, line.referenceUnit, line.baseUnit as BaseUnit) == null)) ||
      (line.checked && !line.usefulQuantity) ||
      (line.usefulQuantity && (Number(line.usefulQuantity) <= 0 || Number(line.usefulQuantity) > (normalized(line) || 0))))) {
      setNotice("Revise o item, as camadas da embalagem, o conteúdo e a quantidade útil de cada linha.");
      return;
    }
    if (!Number.isFinite(total) || total < 0 || Number(discount || 0) > subtotal) {
      setNotice("Confira o desconto, o frete e o total da nota.");
      return;
    }
    setBusy(true);
    const { error } = await requireSupabase().rpc(editingInvoice ? "manager_edit_costing_purchase_invoice" : "manager_save_costing_purchase_invoice_v2", {
      ...(editingInvoice ? { target_invoice_id: editingInvoice.id, expected_invoice: editingInvoice } : {}),
      next_supplier_name: supplier.trim(), next_invoice_number: number.trim(), next_series: series.trim(),
      next_issued_on: issuedOn, next_discount_total: discount || "0", next_freight_total: freight || "0",
      next_notes: notes.trim(), next_lines: lines.map(line => ({
        item_id: line.itemId === "new" ? null : line.itemId,
        new_item_kind: line.itemId === "new" ? line.newItemKind : null,
        new_item_name: line.itemId === "new" ? line.newItemName.trim() : null,
        new_item_code: line.itemId === "new" ? line.newItemCode.trim() : null,
        base_unit: line.itemId === "new" ? line.baseUnit : null,
        package_layers: line.layers.map(layer => ({ name: layer.name.trim(), quantity: layer.quantity })),
        content_quantity: line.contentQuantity,
        content_unit: units.includes(line.contentUnit as BaseUnit) ? line.contentUnit : null,
        content_unit_catalog_id: line.contentUnit !== "new" && !units.includes(line.contentUnit as BaseUnit) ? line.contentUnit : null,
        new_content_unit_name: line.contentUnit === "new" ? line.newContentUnitName.trim() : null,
        new_content_unit_quantity: line.contentUnit === "new" ? line.newContentUnitQuantity : null,
        new_content_unit_physical_unit: line.contentUnit === "new" ? line.newContentUnitPhysicalUnit : null,
        useful_quantity: line.usefulQuantity || null, checked: line.checked,
        unit_price: line.unitPrice,
        brand_name: line.brandName.trim(), item_notes: line.itemNotes.trim(),
        reference_package_name: line.itemId === "new" ? line.referencePackageName.trim() || null : null,
        reference_quantity: line.itemId === "new" ? line.referenceQuantity || null : null,
        reference_unit: line.itemId === "new" ? line.referenceUnit || null : null,
      })),
    });
    if (error) { setBusy(false); setNotice(error.message); return; }
    setSupplier(""); setNumber(""); setSeries(""); setIssuedOn(""); setDiscount(""); setFreight(""); setNotes("");
    setLines([nextLine()]); setEditingInvoice(null);
    await Promise.all([onSaved(), loadHistory(), loadCatalog(), loadSuppliers()]);
    setBusy(false);
    setNotice("Nota salva. Preços históricos atualizados para custo; nenhum estoque foi movimentado.");
  };

  return <div className="adoce-invoice">
    {archivingInvoice && <CostRecordArchiveDialog kind="invoice" id={archivingInvoice.id} name={archivingInvoice.name} restore={archivingInvoice.restore} onClose={() => setArchivingInvoice(null)} onSaved={async () => { await Promise.all([onSaved(), loadHistory(), loadSuppliers(), loadArchived()]); }} />}
    <p className="adoce-invoice-intro">Registre a nota e descreva como cada item veio embalado. As quantidades calculam o custo; este cadastro não controla estoque.</p>
    <datalist id="adoce-package-names">{[...new Set(["caixa", "pacote", "saca", "bag", "bandeja", "garrafa", "unidade", "fardo", ...catalog.package_types.map(item => item.name)])].map(name => <option key={name} value={name} />)}</datalist>
    <datalist id="adoce-brand-names">{[...new Set(invoices.flatMap(invoice => invoice.lines.map(line => line.brand_name)).filter(Boolean))].sort().map(name => <option key={name} value={name} />)}</datalist>
    {notice && <p role="status" className="adoce-cost-notice">{notice}</p>}
    <button type="button" disabled={busy} onClick={() => setEditingCatalog(true)}>Editar fornecedores e embalagens</button>
    {editingCatalog && <CostPurchaseCatalogEditor suppliers={suppliers} packages={catalog.package_types} contents={catalog.content_units} onClose={() => setEditingCatalog(false)} onSaved={async () => { await Promise.all([loadCatalog(), loadSuppliers()]); setNotice("Cadastro atualizado. Compras anteriores preservadas."); }} />}
    <form ref={formRef} onSubmit={save}>
      <section className="adoce-invoice-card">
        <h4>{editingInvoice ? `Editar nota ${editingInvoice.invoice_number}` : "Dados da nota fiscal"}</h4>
        {editingInvoice && <><p>Ao salvar, os custos serão recalculados. A versão anterior desta nota ficará disponível no histórico de correções.</p><button type="button" disabled={busy} onClick={cancelEditing}>Cancelar edição da nota</button></>}
        <div className="adoce-invoice-fields">
          <label>Fornecedor<select required value={supplier} onChange={e => setSupplier(e.target.value)}><option value="">Selecione um fornecedor cadastrado</option>{suppliers.map(entry => <option key={entry.id} value={entry.name}>{entry.name}</option>)}</select></label>
          <label>Número da nota<input required maxLength={80} value={number} onChange={e => setNumber(e.target.value)} /></label>
          <label>Série<input maxLength={40} value={series} onChange={e => setSeries(e.target.value)} placeholder="Se houver" /></label>
          <label>Data de emissão<input required type="date" max={new Date().toISOString().slice(0, 10)} value={issuedOn} onChange={e => setIssuedOn(e.target.value)} /></label>
        </div>
        <div className="adoce-invoice-supplier-create"><label>Novo fornecedor<input maxLength={160} value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} placeholder="Nome que constará nas notas" /></label><button type="button" onClick={() => void createSupplier()} disabled={busy || !newSupplierName.trim()}>Cadastrar e selecionar</button></div>
        {suppliers.length > 0 && <details className="adoce-invoice-supplier-list"><summary>Fornecedores cadastrados ({suppliers.length})</summary><ul>{suppliers.map(entry => <li key={entry.id}>{entry.name} · {entry.invoice_count} {Number(entry.invoice_count) === 1 ? "nota" : "notas"}{entry.last_purchase ? ` · última compra ${entry.last_purchase.split("-").reverse().join("/")}` : ""}</li>)}</ul></details>}
      </section>
      {lines.map((line, index) => {
        const baseUnit = baseUnitOf(line);
        const quantity = normalized(line);
        const gross = grossLineTotal(line.layers[0]?.quantity || "", line.unitPrice);
        const grossNumber = gross == null ? null : Number(gross);
        const netEstimate = grossNumber == null || subtotal <= 0 ? null
          : grossNumber - Number(discount || 0) * grossNumber / subtotal + Number(freight || 0) * grossNumber / subtotal;
        const unitCost = quantity && netEstimate != null && netEstimate >= 0 ? netEstimate / Number(line.usefulQuantity || quantity) : null;
        const selectedItem = items.find(item => item.id === line.itemId);
        const referenceRequested = Boolean(line.referencePackageName || line.referenceQuantity || line.referenceUnit);
        const referenceName = line.itemId === "new" ? line.referencePackageName : selectedItem?.reference_package_name;
        const referenceQuantity = line.itemId === "new" ? line.referenceQuantity : selectedItem?.reference_quantity;
        const referenceUnit = line.itemId === "new" ? line.referenceUnit : selectedItem?.reference_unit;
        const referenceBase = baseUnit ? referenceQuantityInBase(referenceQuantity || null, referenceUnit || null, baseUnit) : null;
        return <section className="adoce-invoice-card" key={line.key}>
          <div className="adoce-invoice-card-head"><h4>Item {index + 1}</h4>{lines.length > 1 && <button type="button" onClick={() => setLines(current => current.filter(candidate => candidate.key !== line.key))}>Remover item</button>}</div>
          <div className="adoce-invoice-fields">
            <label className="adoce-invoice-wide">Insumo ou embalagem<select required value={line.itemId} onChange={e => updateLine(line.key, { itemId: e.target.value, usefulQuantity: "", checked: false })}>
              <option value="">Selecione</option><option value="new">+ Cadastrar novo item nesta nota</option>
              {items.filter(item => item.active && ["ingredient", "packaging"].includes(item.item_kind)).map(item => <option key={item.id} value={item.id}>{item.name} ({item.consumption_unit})</option>)}
            </select></label>
            {line.itemId === "new" && <>
              <label>Tipo<select value={line.newItemKind} onChange={e => updateLine(line.key, { newItemKind: e.target.value as DraftLine["newItemKind"] })}><option value="ingredient">Insumo</option><option value="packaging">Embalagem</option></select></label>
              <label>Nome do novo item<input required maxLength={160} value={line.newItemName} onChange={e => updateLine(line.key, { newItemName: e.target.value })} /></label>
              <label>Código interno<input maxLength={40} value={line.newItemCode} onChange={e => updateLine(line.key, { newItemCode: e.target.value })} placeholder="Gerado automaticamente se vazio" /></label>
              <label>Calcular custo e uso por<select required value={line.baseUnit} onChange={e => updateLine(line.key, { baseUnit: e.target.value as BaseUnit, referenceUnit: "", usefulQuantity: "", checked: false })}><option value="">Escolha a unidade</option>{costUnits.map(unit => <option key={unit} value={unit}>{unit === "unit" ? "unidade" : unit === "g" ? "grama" : "mililitro"}</option>)}</select></label>
              <fieldset className="adoce-reference-fields adoce-invoice-wide"><legend>Embalagem de referência para comparar preços</legend>
                <div className="adoce-invoice-fields"><label>Nome da embalagem<input required={referenceRequested} maxLength={60} value={line.referencePackageName} onChange={e => updateLine(line.key, { referencePackageName: e.target.value })} placeholder="Ex.: caixinha" /></label><label>Conteúdo padrão<input required={referenceRequested} type="number" min="0.000001" step="any" value={line.referenceQuantity} onChange={e => updateLine(line.key, { referenceQuantity: e.target.value })} placeholder="Ex.: 395" /></label><label>Unidade<select required={referenceRequested} value={line.referenceUnit} onChange={e => updateLine(line.key, { referenceUnit: e.target.value as BaseUnit })}><option value="">Escolha</option>{referenceUnits(line.baseUnit).map(unit => <option key={unit} value={unit}>{unit === "unit" ? "unidade" : unit}</option>)}</select></label></div>
                <small>Opcional. O preço equivalente aparece abaixo sem alterar o custo por {line.baseUnit || "unidade de uso"}.</small>
              </fieldset>
            </>}
            <label>Marca comprada nesta nota<input list="adoce-brand-names" maxLength={120} value={line.brandName} onChange={e => updateLine(line.key, { brandName: e.target.value })} placeholder="Ex.: marca do fabricante" /></label>
            <label className="adoce-invoice-wide">Observação deste item<textarea maxLength={1000} value={line.itemNotes} onChange={e => updateLine(line.key, { itemNotes: e.target.value })} placeholder="Ex.: tipo profissional, mínimo 8% de gordura" /></label>
          </div>
          <h5>Como veio embalado</h5>
          <p className="adoce-invoice-hint">Ex.: 10 caixas × 27 unidades × 395 g; ou 7 caixas × 2 bags × 5 kg.</p>
          {line.layers.map((layer, layerIndex) => <div className="adoce-invoice-layer" key={layerIndex}>
            <label>Quantidade<input required type="number" min="1" step="1" value={layer.quantity} onChange={e => updateLayer(line.key, layerIndex, { quantity: e.target.value })} /></label>
            <label>Tipo de embalagem — escolha ou digite novo<input required list="adoce-package-names" maxLength={40} value={layer.name} onChange={e => updateLayer(line.key, layerIndex, { name: e.target.value })} placeholder="caixa, pacote, saca, bag..." /></label>
            {line.layers.length > 1 && <button type="button" onClick={() => updateLine(line.key, { layers: line.layers.filter((_, i) => i !== layerIndex) })}>Remover nível</button>}
          </div>)}
          <p className="adoce-invoice-hint">Um tipo novo digitado aqui será cadastrado ao salvar a nota.</p>
          <button type="button" disabled={line.layers.length >= 5} onClick={() => updateLine(line.key, { layers: [...line.layers, { name: "", quantity: "" }] })}>+ Outro nível de embalagem</button>
          <div className="adoce-invoice-fields">
            <label>Conteúdo por unidade final<input required type="number" min="0.000001" step="any" value={line.contentQuantity} onChange={e => updateLine(line.key, { contentQuantity: e.target.value, usefulQuantity: "", checked: false })} /></label>
            <label>Unidade do conteúdo<select required value={line.contentUnit} onChange={e => updateLine(line.key, { contentUnit: e.target.value, usefulQuantity: "", checked: false })}><option value="">Escolha a unidade</option>{units.map(unit => <option key={unit} value={unit}>{unit === "unit" ? "unidade" : unit}</option>)}{catalog.content_units.map(unit => <option key={unit.id} value={unit.id}>{unit.name} = {unit.physical_quantity} {unit.physical_unit}</option>)}<option value="new">+ Cadastrar nova unidade nesta nota</option></select></label>
            {line.contentUnit === "new" && <div className="adoce-invoice-new-unit adoce-invoice-wide">
              <strong>Nova unidade de conteúdo</strong>
              <div className="adoce-invoice-fields">
                <label>Nome da unidade<input required maxLength={80} value={line.newContentUnitName} onChange={e => updateLine(line.key, { newContentUnitName: e.target.value })} placeholder="Ex.: bag de 5 kg" /></label>
                <label>Quanto contém<input required type="number" min="0.000001" step="any" value={line.newContentUnitQuantity} onChange={e => updateLine(line.key, { newContentUnitQuantity: e.target.value, usefulQuantity: "", checked: false })} /></label>
                <label>Medida do conteúdo<select required value={line.newContentUnitPhysicalUnit} onChange={e => updateLine(line.key, { newContentUnitPhysicalUnit: e.target.value as BaseUnit, usefulQuantity: "", checked: false })}><option value="">Escolha</option>{units.map(unit => <option key={unit} value={unit}>{unit === "unit" ? "unidade" : unit}</option>)}</select></label>
              </div>
              <small>Ex.: nome “bag”, contém 5 kg. Esta unidade ficará disponível nas próximas notas.</small>
            </div>}
            <label>Preço unitário da embalagem externa (R$)<input required type="text" inputMode="numeric" value={line.unitPrice ? money(Number(line.unitPrice)) : ""} onChange={e => updateLine(line.key, { unitPrice: moneyFromTypedDigits(e.target.value) })} placeholder="R$ 0,00" /></label>
            <label>Valor total bruto do item (R$)<input readOnly value={gross == null ? "Preencha quantidade e preço" : money(Number(gross))} /></label>
            <label>Quantidade útil total{baseUnit ? ` (${baseUnit})` : ""}<input type="number" min="0.000001" step="any" value={line.usefulQuantity} onChange={e => updateLine(line.key, { usefulQuantity: e.target.value, checked: false })} placeholder="Informe após perdas, se houver" /></label>
          </div>
          <div className="adoce-invoice-result">
            <strong>{quantity == null ? "Preencha as embalagens e o conteúdo" : `Quantidade total para custo: ${quantity.toLocaleString("pt-BR")} ${baseUnit}`}</strong>
            {gross != null && <span>{line.layers[0].quantity} {line.layers[0].name || "embalagens"} × {money(Number(line.unitPrice))} = {money(Number(gross))}</span>}
            {unitCost != null && <span>Custo estimado com desconto e frete: {unitMoney(unitCost)} / {baseUnit}</span>}
            {referenceBase != null && referenceName && <span className="adoce-reference-result">Custo equivalente a uma {referenceName} de {referenceQuantity} {referenceUnit}: {unitCost == null ? "preencha preço e quantidade" : `${money(unitCost * referenceBase)} (estimativa)`}</span>}
            {quantity != null && <button type="button" onClick={() => updateLine(line.key, { usefulQuantity: String(quantity), checked: false })}>Usar quantidade total como útil (sem perda)</button>}
            <label><input type="checkbox" checked={line.checked} disabled={!line.usefulQuantity} onChange={e => updateLine(line.key, { checked: e.target.checked })} /> Preço e quantidade útil conferidos</label>
            <small>O custo usa o valor da nota e a quantidade comprada. Ao conferir a quantidade útil, o cálculo passa a usar essa nova referência.</small>
          </div>
        </section>;
      })}
      <button type="button" onClick={() => setLines(current => [...current, nextLine()])}>+ Adicionar outro item à nota</button>
      <section className="adoce-invoice-card">
        <h4>Fechamento da nota</h4>
        <div className="adoce-invoice-fields">
          <label>Desconto total (R$)<input type="text" inputMode="numeric" value={discount ? money(Number(discount)) : ""} onChange={e => setDiscount(moneyFromTypedDigits(e.target.value))} placeholder="R$ 0,00" /></label>
          <label>Frete total (R$)<input type="text" inputMode="numeric" value={freight ? money(Number(freight)) : ""} onChange={e => setFreight(moneyFromTypedDigits(e.target.value))} placeholder="R$ 0,00" /></label>
          <label className="adoce-invoice-wide">Observações<textarea maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} /></label>
        </div>
        <p>Subtotal: {money(subtotal)} · Total com desconto e frete: {money(total)}</p>
        <p className="adoce-invoice-hint">Desconto e frete são distribuídos proporcionalmente ao valor bruto dos itens. A nota e os preços anteriores permanecem no histórico.</p>
        <button type="submit" disabled={busy}>{busy ? "Salvando nota..." : editingInvoice ? "Salvar correção e atualizar custos" : "Salvar nota e atualizar custos"}</button>
      </section>
    </form>
    <section className="adoce-invoice-card">
      <h4>Notas cadastradas</h4><label>Ordenar notas<select value={invoiceSort} onChange={event=>setInvoiceSort(event.target.value)}><option value="newest">Mais recentes</option><option value="oldest">Mais antigas</option><option value="supplier">Fornecedor A–Z</option><option value="total">Maior valor</option></select></label>
      <button type="button" onClick={() => void loadArchived()}>Notas excluídas · restaurar</button>
      {archivedInvoices && <div>{archivedInvoices.length ? archivedInvoices.map(invoice => <article key={invoice.id}><p>{invoice.issued_on} · {invoice.supplier_name} · nota {invoice.invoice_number} · {money(invoice.total_cost)}</p><button type="button" disabled={busy} onClick={() => setArchivingInvoice({ id: invoice.id, name: `${invoice.supplier_name} · Nota ${invoice.invoice_number}`, restore: true })}>Restaurar nota</button></article>) : <p>Nenhuma nota excluída.</p>}</div>}
      {invoices.length ? [...invoices].sort((a,b)=>invoiceSort==="total"?b.total_cost-a.total_cost:invoiceSort==="supplier"?a.supplier_name.localeCompare(b.supplier_name,"pt-BR"):invoiceSort==="oldest"?a.issued_on.localeCompare(b.issued_on):b.issued_on.localeCompare(a.issued_on)).map(invoice => <details key={invoice.id}>
        <summary>{invoice.issued_on.split("-").reverse().join("/")} · {invoice.supplier_name} · nota {invoice.invoice_number}{invoice.series ? `/${invoice.series}` : ""} · {money(invoice.total_cost)}</summary>
        <button type="button" disabled={busy} onClick={() => openInvoice(invoice)}>Editar nota</button>
        <button type="button" disabled={busy} onClick={() => setArchivingInvoice({ id: invoice.id, name: `${invoice.supplier_name} · Nota ${invoice.invoice_number}`, restore: false })}>Excluir nota</button>
        <button type="button" disabled={busy} onClick={() => void loadRevisions(invoice.id)}>Histórico de correções</button>
        {revisions[invoice.id] && <div>{revisions[invoice.id].length ? revisions[invoice.id].map(old => <details key={old.id}><summary>Versão anterior · {old.issued_on} · {old.supplier_name} · {money(old.total_cost)}</summary><ul>{old.lines?.map((line, index) => <li key={index}>{line.item_name} · {line.brand_name || "Marca não informada"} · {line.normalized_quantity} {line.normalized_unit} · {money(line.net_total)}</li>)}</ul></details>) : <p>Esta nota ainda não teve correções.</p>}</div>}
        <ul>{invoice.lines.map(line => <li key={line.id}><strong>{line.item_name}</strong>{line.brand_name ? ` · Marca: ${line.brand_name}` : " · Marca não informada"}: {line.package_layers.map(layer => `${layer.quantity} ${layer.name}`).join(" × ")} × {line.content_presentation ? `${line.entered_content_quantity} ${line.content_presentation}` : `${line.content_quantity} ${line.content_unit}`} = {line.normalized_quantity} {line.normalized_unit}; {line.outer_unit_price == null ? "" : `${money(line.outer_unit_price)} por embalagem externa · bruto ${money(line.gross_total)} · `}custo após rateio {money(line.net_total)}{line.useful_quantity == null ? " · quantidade útil pendente" : ` · útil ${line.useful_quantity} ${line.normalized_unit}`}{line.item_notes && <div>Observação: {line.item_notes}</div>}</li>)}</ul>
      </details>) : <p>Nenhuma nota cadastrada.</p>}
    </section>
    <section className="adoce-invoice-card">
      <h4>Comparar preços por marca</h4>
      <p className="adoce-invoice-hint">Compare o custo por unidade de uso do mesmo insumo, mesmo quando as embalagens compradas forem diferentes. Antes da conferência, o cálculo usa a quantidade comprada; depois, usa a quantidade útil informada.</p>
      <label>Insumo ou embalagem<select value={historyItem} onChange={e => setHistoryItem(e.target.value)}><option value="">Escolha para comparar</option>{[...new Map(invoices.flatMap(invoice => invoice.lines.map(line => [line.item_id, line.item_name] as const))).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      {historyItem && <div className="adoce-invoice-history-scroll"><table className="adoce-invoice-history"><thead><tr><th>Compra</th><th>Marca</th><th>Fornecedor</th><th>Preço por embalagem</th><th>Custo por unidade de uso</th><th>Embalagem de referência atual</th><th>Observação</th></tr></thead><tbody>{invoices.flatMap(invoice => invoice.lines.filter(line => line.item_id === historyItem).map(line => <tr key={line.id}><td>{invoice.issued_on.split("-").reverse().join("/")}</td><td>{line.brand_name || "Não informada"}</td><td>{invoice.supplier_name}</td><td>{line.outer_unit_price == null ? "—" : money(line.outer_unit_price)}</td><td>{unitMoney(line.net_total / Number(line.useful_quantity || line.normalized_quantity))} / {line.normalized_unit}</td><td>{referenceComparison(line.item_id, line.net_total, Number(line.useful_quantity || line.normalized_quantity))}</td><td>{line.item_notes || "—"}</td></tr>))}</tbody></table></div>}
    </section>
  </div>;
}
